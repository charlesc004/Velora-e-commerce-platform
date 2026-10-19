import type { CartItem } from '@velora/contracts';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { money } from '@/lib/utils/currency';
import { QuantitySelector } from './QuantitySelector';
export function CartItems({
  items,
  onUpdate,
  disabled,
}: {
  items: CartItem[];
  onUpdate?: (productId: string, variantId: string, quantity: number) => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <div className="cart-items">
      {items.map((item) => {
        const variant = item.product.variants.find((v) => v.id === item.variantId);
        const unavailable =
          !variant || variant.stock < item.quantity || item.product.status !== 'published';
        return (
          <article className="cart-item" key={`${item.productId}-${item.variantId}`}>
            <Link to={`/product/${item.product.slug}`} className="cart-item-image">
              <img src={item.product.images[0]} alt={item.product.name} width="140" height="180" />
            </Link>
            <div className="cart-item-copy">
              <p className="product-category">{item.product.category}</p>
              <h3>
                <Link to={`/product/${item.product.slug}`}>{item.product.name}</Link>
              </h3>
              <p>
                {variant?.color || 'Unavailable'} / {variant?.size || 'Variant removed'}
              </p>
              {unavailable && (
                <p className="field-error">
                  Please update this item. The selected quantity is unavailable.
                </p>
              )}
              {onUpdate ? (
                <QuantitySelector
                  value={item.quantity}
                  max={variant?.stock || 0}
                  disabled={disabled}
                  onChange={(q) => onUpdate(item.productId, item.variantId, q)}
                />
              ) : (
                <p>Quantity: {item.quantity}</p>
              )}
            </div>
            <div className="cart-item-end">
              <span>{money(item.product.price * item.quantity)}</span>
              {onUpdate && (
                <button
                  aria-label={`Remove ${item.product.name} from bag`}
                  disabled={disabled}
                  onClick={() => onUpdate(item.productId, item.variantId, 0)}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
