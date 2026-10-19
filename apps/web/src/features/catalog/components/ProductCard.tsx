import { Heart, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '@velora/contracts';
import { ProductPrice } from './ProductPrice';
export function ProductCard({
  product,
  saved = false,
  onWishlist,
}: {
  product: Product;
  saved?: boolean;
  onWishlist?: (product: Product) => void;
}): React.JSX.Element {
  const colors = [...new Map(product.variants.map((v) => [v.color, v.colorHex])).entries()];
  return (
    <article className="product-card">
      <div className="product-card-image">
        <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`}>
          <img src={product.images[0]} alt={product.name} loading="lazy" width="600" height="800" />
          <span className="product-view">
            Discover <ArrowUpRight size={15} />
          </span>
        </Link>
        {product.compareAtPrice && product.compareAtPrice > product.price ? (
          <span className="product-label">THE CONSIDERED SALE</span>
        ) : product.tags.includes('new') || product.tags.includes('new-season') ? (
          <span className="product-label">NEW SEASON</span>
        ) : null}
        {onWishlist && (
          <button
            className={`wishlist-button ${saved ? 'saved' : ''}`}
            aria-label={`${saved ? 'Remove' : 'Save'} ${product.name}${saved ? ' from wishlist' : ' to wishlist'}`}
            onClick={() => onWishlist(product)}
          >
            <Heart size={18} strokeWidth={1.4} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="product-card-meta">
        <div>
          <p className="product-category">{product.category.replaceAll('-', ' ')}</p>
          <Link to={`/product/${product.slug}`}>
            <h3>{product.name}</h3>
          </Link>
          <div
            className="color-dots"
            aria-label={`Available in ${colors.map(([color]) => color).join(', ')}`}
          >
            {colors.slice(0, 4).map(([color, hex]) => (
              <span key={color} title={color} style={{ background: hex }} />
            ))}
            {colors.length > 4 && <small>+{colors.length - 4}</small>}
          </div>
        </div>
        <div className="product-price">
          <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
        </div>
      </div>
    </article>
  );
}
