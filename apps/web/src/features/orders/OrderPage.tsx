import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Check, Package, ArrowUpRight, CircleCheck, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrderQuery } from './orders.api';
import { usePayMockMutation, useStripeSessionMutation } from '@/features/checkout/api/checkout.api';
import { OrderSummary } from '@/features/checkout/components/OrderSummary';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAppDispatch } from '@/app/store';
import { guestCartActions } from '@/features/cart/cart.slice';
export default function OrderPage(): React.JSX.Element {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || undefined;
  const result = useOrderQuery({ id, token });
  const [payMock, paying] = usePayMockMutation();
  const [stripeSession, stripe] = useStripeSessionMutation();
  const order = result.data;
  const dispatch = useAppDispatch();
  const returningFromPayment = params.has('payment');
  const { refetch } = result;
  useEffect(() => {
    if (!order || order.paymentStatus !== 'paid' || order.userId) return;
    dispatch(guestCartActions.consumeOrder({ orderId: order.id, items: order.items }));
  }, [order, dispatch]);
  useEffect(() => {
    if (!returningFromPayment || order?.status !== 'pending') return;
    const interval = setInterval(() => void refetch(), 5000);
    return () => clearInterval(interval);
  }, [returningFromPayment, order?.status, refetch]);
  usePageMeta(order ? `Order ${order.number}` : 'Your order');
  if (result.isLoading)
    return (
      <div className="container section">
        <LoadingSkeleton count={2} />
      </div>
    );
  if (result.error || !order)
    return (
      <div className="container section">
        <ErrorState error={result.error} retry={result.refetch} />
      </div>
    );
  const paid = order.paymentStatus === 'paid';
  async function pay(): Promise<void> {
    if (!order) return;
    try {
      if (order.paymentMethod === 'mock') {
        await payMock({ orderId: order.id, guestToken: token, outcome: 'success' }).unwrap();
        toast.success('Payment complete. Your order is confirmed.');
      } else {
        const session = await stripeSession({ orderId: order.id, guestToken: token }).unwrap();
        if (session.url) location.assign(session.url);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <div className="container section order-page">
      <div className="order-confirmation">
        <span className="confirmation-icon">
          {paid ? <Check size={28} strokeWidth={1.3} /> : <Clock3 size={27} strokeWidth={1.3} />}
        </span>
        <p className="eyebrow">{paid ? 'A GOOD CHOICE, CONFIRMED' : 'YOUR PIECES ARE RESERVED'}</p>
        <h1>
          {paid
            ? 'Good things are on their way.'
            : order.status === 'expired'
              ? 'A little too much time passed.'
              : order.status === 'cancelled'
                ? 'This order has been cancelled.'
                : 'One last step.'}
        </h1>
        <p>
          {paid
            ? 'Your order is confirmed. We’re taking care of the details.'
            : 'Payment status is verified by our server. Your order will be confirmed when payment is complete.'}
        </p>
        <p className="order-number">
          {order.number} <span>·</span> {date(order.createdAt)}
        </p>
        <Badge>{order.status}</Badge>
      </div>
      <div className="cart-layout">
        <div>
          <h2 className="order-content-title">Your considered collection.</h2>
          {order.items.map((item, i) => (
            <div className="cart-item" key={`${item.variantId}-${i}`}>
              <div className="cart-item-image">
                <img src={item.image} alt={item.name} width="140" height="180" />
              </div>
              <div className="cart-item-copy">
                <h3>{item.name}</h3>
                <p>
                  {item.color} / {item.size}
                </p>
                <p>Quantity: {item.quantity}</p>
              </div>
              <div className="cart-item-end">{money(item.unitPrice * item.quantity)}</div>
            </div>
          ))}
          <div className="order-delivery">
            <div>
              <Package size={23} strokeWidth={1.3} />
              <h3>Thoughtfully delivered to</h3>
              <p>
                {order.address.name}
                <br />
                {order.address.line1}
                {order.address.line2 && `, ${order.address.line2}`}
                <br />
                {order.address.city}, {order.address.region} {order.address.postalCode}
                <br />
                {order.address.country}
              </p>
            </div>
            <div>
              <CircleCheck size={23} strokeWidth={1.3} />
              <h3>A few useful details</h3>
              <p>
                {order.shippingMethod === 'express'
                  ? 'Express delivery · 2–3 business days'
                  : 'Standard delivery · 4–7 business days'}
                <br />
                Payment: {order.paymentStatus}
                <br />
                {order.trackingNumber
                  ? `Tracking: ${order.trackingNumber}`
                  : `Updates for ${order.email}`}
              </p>
            </div>
          </div>
          <Link className="text-link" to="/shop">
            Find your next favorite <ArrowUpRight size={16} />
          </Link>
        </div>
        <aside>
          <OrderSummary totals={order.totals}>
            {order.status === 'pending' && order.paymentStatus === 'pending' && (
              <>
                <p className="summary-note">
                  Reserved until{' '}
                  {order.expiresAt
                    ? new Date(order.expiresAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'your payment session expires'}
                  .
                </p>
                <Button
                  className="full-width"
                  disabled={paying.isLoading || stripe.isLoading}
                  onClick={() => void pay()}
                >
                  Complete {order.paymentMethod === 'mock' ? 'demo payment' : 'payment'}
                </Button>
              </>
            )}
            <p className="summary-note">
              Keep this page for your records. Guest order links contain a private access token.
            </p>
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
