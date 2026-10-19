import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkoutSchema, type CheckoutResult } from '@velora/contracts';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  Package,
  Truck,
  CreditCard,
  CircleCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '@/features/cart/hooks/useCart';
import { useMeQuery } from '@/features/auth/api/auth.api';
import {
  useCheckoutMutation,
  usePayMockMutation,
  useStripeSessionMutation,
  useCheckoutOptionsQuery,
} from '../api/checkout.api';
import { AddressForm, type CustomerDetails } from '@/components/shared/AddressForm';
import { OrderSummary } from '../components/OrderSummary';
import { useCheckoutPreview } from '../hooks/useCheckoutPreview';
import { CartItems } from '@/features/cart/components/CartItems';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { errorMessage } from '@/lib/utils/errors';
import { money } from '@/lib/utils/currency';
import { usePageMeta } from '@/hooks/usePageMeta';
const detailsSchema = checkoutSchema.pick({ email: true, address: true });
export default function CheckoutPage(): React.JSX.Element {
  usePageMeta('A few final details');
  const cart = useCart();
  const { data: user } = useMeQuery();
  const options = useCheckoutOptionsQuery();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState<'standard' | 'express'>('standard');
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [payment, setPayment] = useState<'mock' | 'stripe'>('mock');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CheckoutResult | null>(null);
  useEffect(() => {
    if (!created && options.data && !options.data.paymentMethods.includes(payment)) {
      setPayment(options.data.paymentMethods[0] ?? 'mock');
    }
  }, [options.data, payment, created]);
  const key = useRef(crypto.randomUUID());
  const [checkout, creating] = useCheckoutMutation();
  const [payMock, paying] = usePayMockMutation();
  const [stripeSession, stripe] = useStripeSessionMutation();
  const busy = creating.isLoading || paying.isLoading || stripe.isLoading;
  const preview = useCheckoutPreview({
    items: cart.items.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    })),
    shippingMethod: shipping,
    couponCode: appliedCoupon || undefined,
  });
  const form = useForm<CustomerDetails>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      email: '',
      address: {
        name: '',
        line1: '',
        line2: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'US',
      },
    },
  });
  const { setValue } = form;
  useEffect(() => {
    if (user) {
      setValue('email', user.email);
      setValue('address.name', user.name);
      if (user.addresses[0]) setValue('address', user.addresses[0]);
    }
  }, [user, setValue]);
  async function placeOrder(): Promise<void> {
    setError('');
    try {
      const details = form.getValues();
      const result =
        created ||
        (await checkout({
          ...details,
          items: cart.items.map(({ productId, variantId, quantity }) => ({
            productId,
            variantId,
            quantity,
          })),
          shippingMethod: shipping,
          couponCode: appliedCoupon || undefined,
          paymentMethod: payment,
          idempotencyKey: key.current,
        }).unwrap());
      setCreated(result);
      const tokenQuery = result.guestToken ? `?token=${encodeURIComponent(result.guestToken)}` : '';
      if (payment === 'stripe') {
        const session = await stripeSession({
          orderId: result.order.id,
          guestToken: result.guestToken,
        }).unwrap();
        if (!session.url)
          throw new Error('The payment session could not be opened. Please try again.');
        window.location.assign(session.url);
        return;
      }
      await payMock({
        orderId: result.order.id,
        guestToken: result.guestToken,
        outcome: 'success',
      }).unwrap();
      navigate(`/orders/${result.order.id}${tokenQuery}`);
    } catch (caught) {
      setError(errorMessage(caught));
      toast.error(errorMessage(caught));
    }
  }
  if (!cart.loading && !cart.items.length && !created)
    return (
      <div className="container section">
        <EmptyState
          title="A good place to start."
          description="Find a piece you love before checking out."
        >
          <Button asChild>
            <Link to="/shop">Explore the collection</Link>
          </Button>
        </EmptyState>
      </div>
    );
  const details = form.getValues();
  return (
    <div className="container section checkout-page">
      <Link className="text-link back-link" to="/cart">
        <ArrowLeft size={14} /> Back to your bag
      </Link>
      <div className="checkout-heading">
        <p className="eyebrow">THOUGHTFULLY DELIVERED</p>
        <h1>A few final details.</h1>
        <div className="checkout-steps" aria-label="Checkout progress">
          {['Your details', 'Delivery', 'Review & pay'].map((label, i) => (
            <span
              className={step >= i + 1 ? 'active' : ''}
              key={label}
              aria-current={step === i + 1 ? 'step' : undefined}
            >
              <b>{step > i + 1 ? <Check size={13} /> : i + 1}</b>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="checkout-layout">
        <div className="checkout-form-panel">
          {step === 1 && (
            <form onSubmit={form.handleSubmit(() => setStep(2))}>
              <div className="checkout-panel-title">
                <h2>Where should we send it?</h2>
                {!user && (
                  <p>
                    Already part of VELORA?{' '}
                    <Link className="underlined" to="/login?redirect=/checkout">
                      Sign in
                    </Link>
                  </p>
                )}
              </div>
              <AddressForm register={form.register} errors={form.formState.errors} />
              <Button className="full-width" type="submit">
                Continue to delivery <ArrowRight size={16} />
              </Button>
            </form>
          )}
          {step === 2 && (
            <>
              <div className="checkout-panel-title">
                <h2>At your own pace.</h2>
                <p>Select your preferred delivery method.</p>
              </div>
              <div className="shipping-options">
                {[
                  {
                    id: 'standard' as const,
                    title: 'Standard delivery',
                    detail: options.data
                      ? `4–7 business days · ${money(options.data.shipping.standard)} · Free on orders ${money(options.data.shipping.freeThreshold)}+ after discounts`
                      : '4–7 business days',
                    icon: Package,
                  },
                  {
                    id: 'express' as const,
                    title: 'Express delivery',
                    detail: options.data
                      ? `2–3 business days · ${money(options.data.shipping.express)}`
                      : '2–3 business days',
                    icon: Truck,
                  },
                ].map((method) => (
                  <label
                    className={`choice-card ${shipping === method.id ? 'active' : ''}`}
                    key={method.id}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={method.id}
                      checked={shipping === method.id}
                      onChange={() => setShipping(method.id)}
                    />
                    <method.icon size={25} strokeWidth={1.2} />
                    <div>
                      <h3>{method.title}</h3>
                      <p>{method.detail}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="checkout-action-row">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft size={15} /> Your details
                </Button>
                <Button onClick={() => setStep(3)}>
                  Review your order <ArrowRight size={15} />
                </Button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="checkout-panel-title">
                <h2>A last look.</h2>
                <p>Everything in its right place.</p>
              </div>
              <div className="review-address">
                <div>
                  <p className="eyebrow">DELIVER TO</p>
                  <strong>{details.address?.name}</strong>
                  <p>
                    {details.address?.line1}
                    {details.address?.line2 ? `, ${details.address.line2}` : ''}
                    <br />
                    {details.address?.city}, {details.address?.region} {details.address?.postalCode}
                    <br />
                    {details.address?.country}
                  </p>
                  <p>{details.email}</p>
                </div>
                <Button variant="ghost" size="sm" disabled={!!created} onClick={() => setStep(1)}>
                  Edit
                </Button>
              </div>
              <CartItems items={cart.items} />
              <h3 className="payment-title">How would you like to pay?</h3>
              <div className="payment-options">
                {options.data?.paymentMethods.includes('mock') && (
                  <label className={`choice-card ${payment === 'mock' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === 'mock'}
                      disabled={!!created}
                      onChange={() => setPayment('mock')}
                    />
                    <CircleCheck size={23} strokeWidth={1.2} />
                    <div>
                      <h3>Demo payment</h3>
                      <p>Complete a simulated payment. No card required.</p>
                    </div>
                  </label>
                )}
                {options.data?.paymentMethods.includes('stripe') && (
                  <label className={`choice-card ${payment === 'stripe' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === 'stripe'}
                      disabled={!!created}
                      onChange={() => setPayment('stripe')}
                    />
                    <CreditCard size={23} strokeWidth={1.2} />
                    <div>
                      <h3>Stripe test checkout</h3>
                      <p>Complete a secure hosted test payment.</p>
                    </div>
                  </label>
                )}
              </div>
              {options.isLoading && <p role="status">Loading payment options…</p>}
              {options.error && <ErrorState error={options.error} retry={options.refetch} />}
              {options.data?.paymentMethods.length === 0 && (
                <p className="field-error" role="alert">
                  Payments are temporarily unavailable. Please try again later.
                </p>
              )}
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                  {created && (
                    <Link
                      className="underlined"
                      to={`/orders/${created.order.id}${created.guestToken ? `?token=${encodeURIComponent(created.guestToken)}` : ''}`}
                    >
                      View your pending order
                    </Link>
                  )}
                </div>
              )}
              <p className="checkout-terms">
                By placing your order, you agree to our <Link to="/information/terms">Terms</Link>{' '}
                and <Link to="/information/privacy">Privacy Policy</Link>.
              </p>
              <Button
                className="full-width"
                disabled={
                  busy ||
                  preview.loading ||
                  !!preview.error ||
                  !preview.totals ||
                  cart.loading ||
                  !options.data?.paymentMethods.includes(payment) ||
                  !!options.error
                }
                onClick={() => void placeOrder()}
              >
                <LockKeyhole size={15} />
                {busy
                  ? 'Preparing your order…'
                  : payment === 'stripe'
                    ? 'Continue to Stripe'
                    : `Place order${preview.totals ? ` · ${money(preview.totals.total)}` : ''}`}
              </Button>
              {!created && (
                <Button className="back-step" variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft size={14} /> Back to delivery
                </Button>
              )}
            </>
          )}
        </div>
        <aside>
          <OrderSummary totals={preview.totals} loading={preview.loading}>
            <form
              className="coupon-form"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedCoupon(coupon.trim().toUpperCase());
              }}
            >
              <label htmlFor="coupon">A little something extra?</label>
              <div>
                <Input
                  id="coupon"
                  placeholder="Discount code"
                  value={coupon}
                  disabled={!!created}
                  onChange={(e) => setCoupon(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={!!created || preview.loading}>
                  Apply
                </Button>
              </div>
              {appliedCoupon && (
                <button
                  type="button"
                  className="text-link"
                  disabled={!!created}
                  onClick={() => {
                    setAppliedCoupon('');
                    setCoupon('');
                  }}
                >
                  Remove {appliedCoupon}
                </button>
              )}
            </form>
            {!!preview.error && (
              <p className="field-error" role="alert">
                {errorMessage(preview.error)}
              </p>
            )}
            <div className="checkout-assurance">
              <LockKeyhole size={17} />
              <p>
                Every detail, protected.
                <br />
                <span>Your payment is handled securely.</span>
              </p>
            </div>
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
