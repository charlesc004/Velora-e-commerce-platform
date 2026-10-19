import type { Totals } from '@velora/contracts';
import type { ReactNode } from 'react';
import { money } from '@/lib/utils/currency';
export function OrderSummary({
  totals,
  loading,
  children,
}: {
  totals?: Totals;
  loading?: boolean;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="order-summary">
      <p className="eyebrow">THE DETAILS</p>
      <h2>Order summary</h2>
      {totals ? (
        <div className={`summary-lines ${loading ? 'pending' : ''}`} aria-busy={loading}>
          <div>
            <span>Subtotal</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="discount-line">
              <span>Considered savings {totals.couponCode && `(${totals.couponCode})`}</span>
              <span>−{money(totals.discount)}</span>
            </div>
          )}
          <div>
            <span>Shipping</span>
            <span>{totals.shipping === 0 ? 'On us' : money(totals.shipping)}</span>
          </div>
          <div>
            <span>Estimated tax</span>
            <span>{money(totals.tax)}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <span>
              <small>USD</small> {money(totals.total)}
            </span>
          </div>
        </div>
      ) : (
        <p className="muted" role="status">
          {loading ? 'Calculating your order…' : 'Your total will appear here.'}
        </p>
      )}
      {children}
    </div>
  );
}
