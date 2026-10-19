import { Router, type RequestHandler } from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { z } from 'zod';
import { checkoutSchema, previewSchema } from '@velora/contracts';
import { config } from '../config.js';
import { AppError, data, parse, objectId, pagination, pageResult, parameter } from '../http.js';
import { OrderModel, PaymentModel, ReservationModel } from '../models.js';
import { orderDto } from '../serializers.js';
import { requireAuth, currentUser } from './auth.js';
import {
  createCheckout,
  quote,
  findOwnedOrder,
  settlePayment,
  expireReservations,
  checkoutOptions,
} from './commerce.js';

const stripe = config.STRIPE_SECRET_KEY ? new Stripe(config.STRIPE_SECRET_KEY) : null;
const paymentSchema = z.object({
  orderId: z.string().min(1),
  guestToken: z.string().max(200).optional(),
});
export const checkoutRoutes = Router();
checkoutRoutes.get('/options', (_req, res) => data(res, checkoutOptions));
checkoutRoutes.post('/preview', async (req, res) =>
  data(res, (await quote(parse(previewSchema, req.body))).totals),
);
checkoutRoutes.post('/orders', async (req, res) =>
  data(res, await createCheckout(parse(checkoutSchema, req.body), req.auth?.user.id), 201),
);

export const orderRoutes = Router();
orderRoutes.get('/', requireAuth, async (req, res) => {
  await expireReservations();
  const { page, limit, skip } = pagination(req);
  const filter = { userId: currentUser(req).id };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    OrderModel.countDocuments(filter),
  ]);
  data(res, pageResult(orders.map(orderDto), total, page, limit));
});
orderRoutes.get('/:id', async (req, res) => {
  await expireReservations();
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  const order = await findOwnedOrder(
    objectId(parameter(req, 'id')),
    req.auth?.user.id,
    token,
    req.auth?.user.role === 'admin',
  );
  data(res, orderDto(order));
});

export const paymentRoutes = Router();
paymentRoutes.post('/mock', async (req, res) => {
  if (!config.mockPayments) throw new AppError(404, 'NOT_FOUND', 'Endpoint not found');
  const input = parse(
    paymentSchema.extend({ outcome: z.enum(['success', 'failure']).default('success') }),
    req.body,
  );
  const order = await findOwnedOrder(objectId(input.orderId), req.auth?.user.id, input.guestToken);
  const paid = await settlePayment(String(order._id), 'mock', input.outcome);
  data(res, { order: orderDto(paid) });
});
paymentRoutes.post('/stripe/session', async (req, res) => {
  if (!stripe)
    throw new AppError(503, 'STRIPE_UNAVAILABLE', 'Stripe test checkout is not configured');
  const input = parse(paymentSchema, req.body);
  await expireReservations();
  const order = await findOwnedOrder(objectId(input.orderId), req.auth?.user.id, input.guestToken);
  if (order.paymentMethod !== 'stripe' || order.status !== 'pending')
    throw new AppError(409, 'ORDER_NOT_PAYABLE', 'This order is not awaiting a Stripe payment');
  if (order.stripeSessionId) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (existing.status === 'open' && existing.url) {
      data(res, { order: orderDto(order), url: existing.url });
      return;
    }
  }
  // Stripe requires a minimum 30-minute hosted session. Extend its inventory hold to the same deadline.
  const stripeExpiry = Math.floor(Date.now() / 1000) + 31 * 60;
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const updated = await OrderModel.updateOne(
        { _id: order._id, status: 'pending', expiresAt: { $gt: new Date() } },
        { $set: { expiresAt: new Date(stripeExpiry * 1000) } },
        { session: dbSession },
      );
      if (!updated.matchedCount)
        throw new AppError(
          409,
          'CHECKOUT_EXPIRED',
          'This checkout has expired. Please check out again.',
        );
      await ReservationModel.updateMany(
        { orderId: order._id, status: 'held' },
        { $set: { expiresAt: new Date(stripeExpiry * 1000) } },
        { session: dbSession },
      );
    });
  } finally {
    await dbSession.endSession();
  }
  const tokenQuery = input.guestToken ? `&token=${encodeURIComponent(input.guestToken)}` : '';
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      expires_at: stripeExpiry,
      customer_email: order.email,
      client_reference_id: String(order._id),
      metadata: { orderId: String(order._id) },
      payment_intent_data: { metadata: { orderId: String(order._id) } },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: order.totals.total,
            product_data: {
              name: `VELORA order ${order.number}`,
              description: `${order.items.reduce((sum, i) => sum + i.quantity, 0)} items including shipping and tax`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${config.WEB_ORIGIN}/orders/${order._id}?payment=success${tokenQuery}`,
      cancel_url: `${config.WEB_ORIGIN}/orders/${order._id}?payment=cancelled${tokenQuery}`,
    },
    { idempotencyKey: `checkout:${order._id}` },
  );
  await OrderModel.updateOne(
    { _id: order._id, status: 'pending' },
    { $set: { stripeSessionId: session.id } },
  );
  data(res, { order: orderDto(order), url: session.url });
});

export const stripeWebhook: RequestHandler = async (req, res) => {
  if (!stripe || !config.STRIPE_WEBHOOK_SECRET)
    throw new AppError(503, 'STRIPE_UNAVAILABLE', 'Stripe webhook is not configured');
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string' || !Buffer.isBuffer(req.body))
    throw new AppError(400, 'INVALID_SIGNATURE', 'A valid Stripe signature is required');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid Stripe webhook signature');
  }
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded' ||
    event.type === 'checkout.session.async_payment_failed' ||
    event.type === 'checkout.session.expired'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId)
      throw new AppError(400, 'MISSING_ORDER', 'The payment event has no order reference');
    const order = await OrderModel.findById(objectId(orderId));
    if (!order || order.stripeSessionId !== session.id)
      throw new AppError(
        400,
        'PAYMENT_SESSION_MISMATCH',
        'Payment session does not match this order',
      );
    const failed =
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired';
    if (failed || session.payment_status === 'paid') {
      const settled = await settlePayment(orderId, 'stripe', failed ? 'failure' : 'success', {
        eventId: event.id,
        type: event.type,
        amount: session.amount_total ?? undefined,
        currency: session.currency ?? undefined,
        providerId:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
      });
      // A delayed success after inventory was released cannot become an unfulfillable paid order.
      if (!failed && settled.paymentStatus !== 'paid' && session.payment_status === 'paid') {
        if (typeof session.payment_intent !== 'string')
          throw new AppError(400, 'MISSING_PAYMENT_INTENT', 'Cannot refund this delayed payment');
        await stripe.refunds.create(
          { payment_intent: session.payment_intent },
          { idempotencyKey: `late-payment:${orderId}` },
        );
        await PaymentModel.updateOne(
          { providerId: session.payment_intent },
          {
            $set: {
              orderId: settled._id,
              provider: 'stripe',
              amount: settled.totals.total,
              currency: 'USD',
              status: 'refunded',
            },
          },
          { upsert: true },
        );
        await OrderModel.updateOne(
          { _id: settled._id, paymentStatus: { $ne: 'paid' } },
          { $set: { paymentStatus: 'refunded' } },
        );
      }
    }
  }
  data(res, { received: true });
};
