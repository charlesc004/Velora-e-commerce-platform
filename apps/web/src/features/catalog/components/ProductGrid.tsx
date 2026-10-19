import type { Product } from '@velora/contracts';
import { useWishlist } from '@/features/wishlist/useWishlist';
import { ProductCard } from './ProductCard';
export function ProductGrid({ products }: { products: Product[] }): React.JSX.Element {
  const wishlist = useWishlist();
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          product={product}
          key={product.id}
          saved={wishlist.isSaved(product.id)}
          onWishlist={(p) => void wishlist.toggle(p)}
        />
      ))}
    </div>
  );
}
