import { createHmac, randomBytes } from 'node:crypto';
import mongoose, { type ClientSession, Types } from 'mongoose';
import type {
  CheckoutInput,
  CheckoutResult,
  OrderStatus,
  PreviewInput,
  Totals,
  OrderItem,
  CheckoutOptions,
} from '@velora/contracts';
import { config } from '../config.js';
import { AppError } from '../http.js';
import {
  CartModel,
  CouponModel,
  MovementModel,
  OrderModel,
  PaymentEventModel,
  PaymentModel,
  ProductModel,
  ReservationModel,
  type CouponRecord,
  type OrderRecord,
} from '../models.js';
import { orderDto } from '../serializers.js';
import { hashToken } from './auth.js';
import { normalizeLines } from './carts/cart.service.js';

export const commercePolicy = {
  shipping: { standard: 800, express: 1800, freeThreshold: 15000 },
  taxRate: 0.08,
} as const;

export const checkoutOptions: CheckoutOptions = {
  ...commercePolicy,
  paymentMethods: [
    ...(config.mockPayments ? (['mock'] as const) : []),
    ...(config.STRIPE_SECRET_KEY ? (['stripe'] as const) : []),
  ],
};

export function calculateTotals(
  subtotal: number,
  shippingMethod: 'standard' | 'express',
  coupon?: Pick<CouponRecord, 'type' | 'value' | 'code'>,
): Totals {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0)
    throw new AppError(422, 'INVALID_TOTAL', 'Invalid order subtotal');
  const discount = coupon
    ? Math.min(
        subtotal,
        coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value,
      )
    : 0;
  const taxable = subtotal - discount;
  const shipping =
    shippingMethod === 'express'
      ? commercePolicy.shipping.express
      : taxable >= commercePolicy.shipping.freeThreshold
        ? 0
        : commercePolicy.shipping.standard;
  const tax = Math.round(taxable * commercePolicy.taxRate);
  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: taxable + shipping + tax,
    currency: 'USD',
    ...(coupon ? { couponCode: coupon.code } : {}),
  };
}

export async function quote(
  input: PreviewInput,
  session?: ClientSession,
): Promise<{ items: OrderItem[]; totals: Totals; couponId?: Types.ObjectId }> {
  if (!input.items.length) throw new AppError(422, 'EMPTY_CART', 'Your bag is empty');
  const items = normalizeLines(input.items);
  const totalRequested = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (items.reduce((sum, item) => sum + item.quantity, 0) !== totalRequested)
    throw new AppError(422, 'QUANTITY_LIMIT', 'Select up to 20 units per variant');
  const products = await ProductModel.find({
    _id: { $in: items.map((i) => i.productId) },
    status: 'published',
  }).session(session ?? null);
  const snapshots = items.map((line) => {
    const product = products.find((p) => String(p._id) === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant)
      throw new AppError(409, 'ITEM_UNAVAILABLE', 'An item in your bag is no longer available');
    if (variant.stock < line.quantity)
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `${product.name} has ${variant.stock} units available in this variant`,
      );
    return {
      productId: String(product._id),
      variantId: variant.id,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      quantity: line.quantity,
      unitPrice: product.price,
    };
  });
  const subtotal = snapshots.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  let coupon: (CouponRecord & { _id: Types.ObjectId }) | null = null;
  if (input.couponCode?.trim()) {
    coupon = await CouponModel.findOne({
      code: input.couponCode.trim().toUpperCase(),
      active: true,
    }).session(session ?? null);
    if (
      !coupon ||
      coupon.used >= coupon.usageLimit ||
      (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now())
    )
      throw new AppError(422, 'INVALID_COUPON', 'This discount code is unavailable or has expired');
    if (subtotal < coupon.minimum)
      throw new AppError(
        422,
        'COUPON_MINIMUM',
        `This code requires a subtotal of $${(coupon.minimum / 100).toFixed(2)}`,
      );
  }
  return {
    items: snapshots,
    totals: calculateTotals(subtotal, input.shippingMethod, coupon ?? undefined),
    couponId: coupon?._id,
  };
}

function guestTokenFor(key: string, requestHash: string): string {
  return createHmac('sha256', config.JWT_SECRET)
    .update(`guest:${key}:${requestHash}`)
    .digest('base64url');
}
function checkoutHash(input: CheckoutInput, userId?: string): string {
  return hashToken(
    JSON.stringify({ ...input, items: normalizeLines(input.items), userId: userId ?? null }),
  );
}

function checkoutResult(
  order: OrderRecord & { _id: Types.ObjectId },
  input: CheckoutInput,
  requestHash: string,
  userId?: string,
): CheckoutResult {
  if (String(order.userId ?? '') !== (userId ?? '') || order.requestHash !== requestHash)
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'This checkout key has already been used for a different request',
    );
  return {
    order: orderDto(order),
    ...(!userId ? { guestToken: guestTokenFor(input.idempotencyKey, requestHash) } : {}),
  };
}

export async function createCheckout(
  input: CheckoutInput,
  userId?: string,
): Promise<CheckoutResult> {
  if (input.paymentMethod === 'mock' && !config.mockPayments)
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Mock payments are disabled');
  if (input.paymentMethod === 'stripe' && !config.STRIPE_SECRET_KEY)
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Stripe test checkout is not configured');
  await expireReservations();
  const requestHash = checkoutHash(input, userId);
  const existing = await OrderModel.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return checkoutResult(existing, input, requestHash, userId);
  const orderId = new Types.ObjectId();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const quoted = await quote(input, session);
      const expiresAt = new Date(Date.now() + config.RESERVATION_MINUTES * 60 * 1000);
      if (quoted.couponId) {
        const reserved = await CouponModel.updateOne(
          { _id: quoted.couponId, active: true, $expr: { $lt: ['$used', '$usageLimit'] } },
          { $inc: { used: 1 } },
          { session },
        );
        if (!reserved.modifiedCount)
          throw new AppError(409, 'COUPON_UNAVAILABLE', 'This code has reached its usage limit');
      }
      for (const item of quoted.items) {
        const changed = await ProductModel.updateOne(
          {
            _id: item.productId,
            status: 'published',
            variants: { $elemMatch: { id: item.variantId, stock: { $gte: item.quantity } } },
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session },
        );
        if (!changed.modifiedCount)
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `${item.name} is no longer available in this quantity`,
          );
        await ReservationModel.create(
          [
            {
              orderId,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              status: 'held',
              expiresAt,
            },
          ],
          { session },
        );
        await MovementModel.create(
          [
            {
              productId: item.productId,
              variantId: item.variantId,
              delta: -item.quantity,
              reason: 'Checkout reservation',
              orderId: String(orderId),
              actorId: userId,
            },
          ],
          { session },
        );
      }
      await OrderModel.create(
        [
          {
            _id: orderId,
            number: `VL-${randomBytes(5).toString('hex').toUpperCase()}`,
            userId,
            guestTokenHash: userId
              ? undefined
              : hashToken(guestTokenFor(input.idempotencyKey, requestHash)),
            email: input.email,
            address: input.address,
            items: quoted.items,
            totals: quoted.totals,
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: input.paymentMethod,
            shippingMethod: input.shippingMethod,
            expiresAt,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            couponId: quoted.couponId,
            reservationReleased: false,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    // A concurrent retry can win the unique idempotency key after this request's first lookup.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const winner = await OrderModel.findOne({ idempotencyKey: input.idempotencyKey });
      if (winner) return checkoutResult(winner, input, requestHash, userId);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  const order = await OrderModel.findById(orderId);
  if (!order) throw new AppError(500, 'CHECKOUT_FAILED', 'Could not create your order');
  return checkoutResult(order, input, requestHash, userId);
}

async function releaseOrder(
  order: OrderRecord & { _id: Types.ObjectId },
  session: ClientSession,
  status: 'cancelled' | 'expired',
  paymentStatus: 'pending' | 'failed' = 'failed',
): Promise<void> {
  if (order.reservationReleased || order.status !== 'pending') return;
  const updated = await OrderModel.updateOne(
    { _id: order._id, status: 'pending', reservationReleased: false },
    { $set: { status, paymentStatus, reservationReleased: true } },
    { session },
  );
  if (!updated.modifiedCount) return;
  const reservations = await ReservationModel.find({ orderId: order._id, status: 'held' }).session(
    session,
  );
  for (const reservation of reservations) {
    await ProductModel.updateOne(
      { _id: reservation.productId, 'variants.id': reservation.variantId },
      { $inc: { 'variants.$.stock': reservation.quantity } },
      { session },
    );
    await MovementModel.create(
      [
        {
          productId: reservation.productId,
          variantId: reservation.variantId,
          delta: reservation.quantity,
          reason:
            status === 'expired' ? 'Expired checkout released' : 'Cancelled checkout released',
          orderId: String(order._id),
        },
      ],
      { session },
    );
  }
  await ReservationModel.updateMany(
    { orderId: order._id, status: 'held' },
    { $set: { status: 'released' } },
    { session },
  );
  if (order.couponId)
    await CouponModel.updateOne(
      { _id: order.couponId, used: { $gt: 0 } },
      { $inc: { used: -1 } },
      { session },
    );
}

let expirationRunning: Promise<void> | undefined;
export async function expireReservations(): Promise<void> {
  if (expirationRunning) return expirationRunning;
  expirationRunning = (async () => {
    const expired = await OrderModel.find({ status: 'pending', expiresAt: { $lte: new Date() } })
      .select('_id')
      .limit(1000)
      .lean();
    for (const value of expired) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const order = await OrderModel.findOne({
            _id: value._id,
            status: 'pending',
            expiresAt: { $lte: new Date() },
          }).session(session);
          if (order) await releaseOrder(order, session, 'expired');
        });
      } finally {
        await session.endSession();
      }
    }
  })();
  try {
    await expirationRunning;
  } finally {
    expirationRunning = undefined;
  }
}

export async function findOwnedOrder(id: string, userId?: string, token?: string, admin = false) {
  const order = await OrderModel.findById(id).select('+guestTokenHash');
  if (
    !order ||
    (!admin &&
      (order.userId
        ? String(order.userId) !== userId
        : !token || hashToken(token) !== order.guestTokenHash))
  )
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  return order;
}

interface PaymentEvent {
  eventId: string;
  type: string;
  amount?: number;
  currency?: string;
  providerId?: string;
}
export async function settlePayment(
  orderId: string,
  provider: 'mock' | 'stripe',
  outcome: 'success' | 'failure',
  event?: PaymentEvent,
) {
  await expireReservations();
  const session = await mongoose.startSession();
  let timedOut = false;
  try {
    await session.withTransaction(async () => {
      if (event && (await PaymentEventModel.exists({ eventId: event.eventId }).session(session)))
        return;
      const order = await OrderModel.findById(orderId).session(session);
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
      if (order.paymentMethod !== provider)
        throw new AppError(
          409,
          'PAYMENT_PROVIDER_MISMATCH',
          'This order uses another payment method',
        );
      if (
        event &&
        outcome === 'success' &&
        (event.amount !== order.totals.total || event.currency?.toLowerCase() !== 'usd')
      )
        throw new AppError(
          409,
          'PAYMENT_AMOUNT_MISMATCH',
          'Payment amount or currency did not match the order',
        );
      if (event)
        await PaymentEventModel.create([{ eventId: event.eventId, type: event.type, orderId }], {
          session,
        });
      if (order.paymentStatus === 'paid') return;
      if (
        order.status !== 'pending' ||
        !order.expiresAt ||
        order.expiresAt.getTime() <= Date.now()
      ) {
        if (order.status === 'pending') await releaseOrder(order, session, 'expired');
        timedOut = true;
        return;
      }
      if (outcome === 'failure') {
        await releaseOrder(order, session, 'cancelled', 'failed');
      } else {
        await OrderModel.updateOne(
          { _id: order._id, status: 'pending' },
          { $set: { status: 'paid', paymentStatus: 'paid' } },
          { session },
        );
        await ReservationModel.updateMany(
          { orderId: order._id, status: 'held' },
          { $set: { status: 'consumed' } },
          { session },
        );
        if (order.userId) {
          const cart = await CartModel.findOne({ userId: order.userId }).session(session);
          if (cart) {
            const remaining = cart.items
              .map((line) => {
                const purchased = order.items.find(
                  (item) => item.productId === line.productId && item.variantId === line.variantId,
                );
                return {
                  productId: line.productId,
                  variantId: line.variantId,
                  quantity: line.quantity - (purchased?.quantity ?? 0),
                };
              })
              .filter((line) => line.quantity > 0);
            await CartModel.updateOne(
              { _id: cart._id },
              { $set: { items: remaining } },
              { session },
            );
          }
        }
      }
      await PaymentModel.updateOne(
        { providerId: event?.providerId ?? `${provider}:${orderId}` },
        {
          $setOnInsert: {
            orderId: order._id,
            provider,
            providerId: event?.providerId ?? `${provider}:${orderId}`,
            amount: order.totals.total,
            currency: 'USD',
            status: outcome === 'success' ? 'paid' : 'failed',
          },
        },
        { upsert: true, session },
      );
    });
  } catch (error) {
    if (!(
      event &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000 &&
      (await PaymentEventModel.exists({ eventId: event.eventId }))
    ))
      throw error;
  } finally {
    await session.endSession();
  }
  const order = await OrderModel.findById(orderId);
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (timedOut && !event)
    throw new AppError(
      409,
      'CHECKOUT_EXPIRED',
      'This checkout has expired. Please check out again.',
    );
  return order;
}

export const allowedOrderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['cancelled'],
  paid: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  expired: [],
};
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (from !== to && !allowedOrderTransitions[from].includes(to))
    throw new AppError(
      409,
      'INVALID_ORDER_TRANSITION',
      `An order cannot move from ${from} to ${to}`,
    );
}
export async function updateOrderStatus(id: string, status: OrderStatus, trackingNumber?: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await OrderModel.findById(id).session(session);
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
      assertOrderTransition(order.status, status);
      if (status === 'shipped' && !(trackingNumber?.trim() || order.trackingNumber))
        throw new AppError(422, 'TRACKING_REQUIRED', 'Add a tracking number before shipping');
      if (status === 'cancelled' && order.status === 'pending')
        await releaseOrder(order, session, 'cancelled');
      else
        await OrderModel.updateOne(
          { _id: order._id },
          { $set: { status, ...(trackingNumber !== undefined ? { trackingNumber } : {}) } },
          { session },
        );
    });
  } finally {
    await session.endSession();
  }
  return OrderModel.findById(id);
}
