import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from '../hooks/useCart';
import { CartItems } from '../components/CartItems';
import { OrderSummary } from '@/features/checkout/components/OrderSummary';
import { useCheckoutPreview } from '@/features/checkout/hooks/useCheckoutPreview';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/utils/errors';
import { usePageMeta } from '@/hooks/usePageMeta';
export default function CartPage(): React.JSX.Element {
  const cart = useCart();
  const preview = useCheckoutPreview({
    items: cart.items.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    })),
    shippingMethod: 'standard',
  });
  usePageMeta('Your shopping bag');
  if (cart.loading)
    return (
      <div className="container section">
        <LoadingSkeleton count={2} />
      </div>
    );
  return (
    <div className="container section cart-page">
      <PageHeader
        eyebrow="A FEW GOOD CHOICES"
        title={`Your bag${cart.count ? ` (${cart.count})` : ''}.`}
        description="Thoughtful additions to your everyday."
      />
      {cart.error ? (
        <ErrorState error={cart.error} />
      ) : !cart.items.length ? (
        <EmptyState
          title="Something good is waiting."
          description="Your bag is taking a moment. Find a piece you’ll reach for again and again."
        >
          <Button asChild>
            <Link to="/shop">
              Discover the collection <ArrowRight size={16} />
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="cart-layout">
          <div>
            <CartItems
              items={cart.items}
              disabled={cart.busy}
              onUpdate={(productId, variantId, quantity) => {
                void cart
                  .update(productId, variantId, quantity)
                  .catch((e) => toast.error(errorMessage(e)));
              }}
            />
            <Link className="text-link continue-shopping" to="/shop">
              Continue exploring <ArrowRight size={15} />
            </Link>
          </div>
          <aside>
            <OrderSummary totals={preview.totals} loading={preview.loading}>
              {!!preview.error && (
                <p className="field-error" role="alert">
                  {errorMessage(preview.error)}
                </p>
              )}
              <Button asChild className={preview.error ? 'disabled-link' : ''}>
                <Link to="/checkout" aria-disabled={!!preview.error}>
                  Continue to checkout <ArrowRight size={17} />
                </Link>
              </Button>
              <p className="secure-note">
                <LockKeyhole size={13} /> Secure checkout. Thoughtfully delivered.
              </p>
              <p className="summary-note">
                Complimentary standard shipping on orders $150+. Discount codes can be applied at
                checkout.
              </p>
            </OrderSummary>
          </aside>
        </div>
      )}
    </div>
  );
}
