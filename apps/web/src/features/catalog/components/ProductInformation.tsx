import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowUpRight,
  Check,
  Truck,
  RotateCcw,
  Star,
  Ruler,
  Heart,
} from 'lucide-react';
import type { Product } from '@velora/contracts';
import { toast } from 'sonner';
import { useCart } from '@/features/cart/hooks/useCart';
import { useWishlist } from '@/features/wishlist/useWishlist';
import { QuantitySelector } from '@/features/cart/components/QuantitySelector';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { money } from '@/lib/utils/currency';
import { errorMessage } from '@/lib/utils/errors';
import { VariantSelector } from './VariantSelector';
import { ProductPrice } from './ProductPrice';
export function ProductInformation({ product }: { product: Product }): React.JSX.Element {
  const [variant, setVariant] = useState(
    product.variants.find((v) => v.stock > 0) || product.variants[0],
  );
  const [quantity, setQuantity] = useState(1);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const cart = useCart();
  const wishlist = useWishlist();
  async function add(): Promise<void> {
    setAdding(true);
    try {
      await cart.add(product, variant.id, quantity);
      toast.success('A good addition to your bag.', {
        action: {
          label: 'View bag',
          onClick: () => {
            window.location.href = '/cart';
          },
        },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }
  return (
    <div className="product-information">
      <p className="eyebrow">{product.collection.replaceAll('-', ' ')}</p>
      <h1>{product.name}</h1>
      <div className="detail-price">
        <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
        <small>USD · Taxes calculated at checkout</small>
      </div>
      <a className="rating-link" href="#reviews">
        <Star size={14} fill="currentColor" />
        {product.rating ? product.rating.toFixed(1) : 'New'}
        <span>({product.reviewCount} reviews)</span>
      </a>
      <p className="product-description">{product.description}</p>
      <VariantSelector
        variants={product.variants}
        selected={variant}
        onChange={(next) => {
          setVariant(next);
          setQuantity(1);
        }}
      />
      <button className="size-guide-link" onClick={() => setSizeOpen(true)}>
        <Ruler size={14} /> Find your fit
      </button>
      <p className={`stock-status ${variant.stock === 0 ? 'out-of-stock' : ''}`}>
        <span />
        {variant.stock === 0
          ? 'This size is taking a little break. Try another.'
          : variant.stock < 5
            ? `Only ${variant.stock} left in this size`
            : 'In stock. Ready for your everyday.'}
      </p>
      <div className="product-buy">
        <QuantitySelector value={quantity} onChange={setQuantity} max={variant.stock} />
        <Button
          disabled={variant.stock < 1 || adding || cart.busy || cart.loading}
          onClick={() => void add()}
        >
          <ShoppingBag size={17} />
          {adding ? 'Adding…' : 'Add to bag'}
          <span>{money(product.price * quantity)}</span>
        </Button>
      </div>
      <Button
        variant="ghost"
        className="product-wishlist-action"
        disabled={wishlist.pending}
        aria-pressed={wishlist.isSaved(product.id)}
        onClick={() => void wishlist.toggle(product)}
      >
        <Heart size={16} fill={wishlist.isSaved(product.id) ? 'currentColor' : 'none'} />
        {wishlist.isSaved(product.id) ? 'Saved to your wishlist' : 'Save to wishlist'}
      </Button>
      <div className="product-perks">
        <p>
          <Truck size={17} strokeWidth={1.3} /> Complimentary shipping on orders $150+
        </p>
        <p>
          <RotateCcw size={17} strokeWidth={1.3} /> Easy returns within 30 days
        </p>
      </div>
      <details open>
        <summary>Details & care</summary>
        <p>
          Thoughtfully crafted with considered materials and a focus on lasting wear. Follow the
          garment label for specific composition and care instructions. Store folded or on a shaped
          hanger, away from direct sunlight.
        </p>
        <Link className="text-link" to="/information/care">
          Our care guide <ArrowUpRight size={14} />
        </Link>
      </details>
      <details>
        <summary>Delivery & returns</summary>
        <p>
          Standard delivery in 4–7 business days. Express delivery in 2–3 business days. Returns
          accepted within 30 days for unworn pieces in original condition.
        </p>
        <Link className="text-link" to="/information/shipping">
          A few more details <ArrowUpRight size={14} />
        </Link>
      </details>
      <Dialog
        open={sizeOpen}
        onOpenChange={setSizeOpen}
        title="A fit that feels like you."
        description="General garment guide in inches. Choose the size closest to your body measurements."
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Chest</th>
              <th>Waist</th>
              <th>Hip</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['XS', '32–34', '25–27', '34–36'],
              ['S', '34–36', '27–29', '36–38'],
              ['M', '36–39', '29–32', '38–41'],
              ['L', '39–42', '32–35', '41–44'],
              ['XL', '42–45', '35–38', '44–47'],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted fit-note">
          <Check size={15} /> Prefer a relaxed fit? We suggest one size up. Accessories marked “One
          size” need no measuring.
        </p>
      </Dialog>
    </div>
  );
}
