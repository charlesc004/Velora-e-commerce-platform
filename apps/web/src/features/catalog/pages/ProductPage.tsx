import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProductQuery, useProductsQuery } from '../api/catalog.api';
import { ProductGallery } from '../components/ProductGallery';
import { ProductInformation } from '../components/ProductInformation';
import { ProductReviews } from '../components/ProductReviews';
import { ProductGrid } from '../components/ProductGrid';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { usePageMeta } from '@/hooks/usePageMeta';
export default function ProductPage(): React.JSX.Element {
  const { slug = '' } = useParams();
  const result = useProductQuery(slug);
  const product = result.data;
  const related = useProductsQuery(
    `category=${encodeURIComponent(product?.category || '')}&limit=5`,
    { skip: !product },
  );
  usePageMeta(product?.name || 'The collection', product?.description);
  useEffect(() => {
    if (!product) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.images.map((i) => new URL(i, location.origin).href),
      sku: product.sku,
      brand: { '@type': 'Brand', name: 'VELORA' },
      offers: {
        '@type': 'Offer',
        url: location.href,
        priceCurrency: 'USD',
        price: (product.price / 100).toFixed(2),
        availability: product.variants.some((v) => v.stock > 0)
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [product]);
  if (result.isLoading)
    return (
      <div className="container section">
        <LoadingSkeleton count={2} />
      </div>
    );
  if (result.error || !product)
    return (
      <div className="container section">
        <ErrorState error={result.error} retry={result.refetch} />
      </div>
    );
  return (
    <div className="container product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <Link to={`/shop?category=${product.category}`}>
          {product.category.replaceAll('-', ' ')}
        </Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery key={product.id} images={product.images} name={product.name} />
        <ProductInformation product={product} key={product.id} />
      </div>
      <div id="reviews">
        <ProductReviews productId={product.id} />
      </div>
      {!!related.data?.items.filter((p) => p.id !== product.id).length && (
        <section className="related-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BETTER TOGETHER</p>
              <h2>In good company.</h2>
            </div>
            <Link className="text-link" to="/shop">
              Explore all pieces
            </Link>
          </div>
          <ProductGrid
            products={related.data.items.filter((p) => p.id !== product.id).slice(0, 4)}
          />
        </section>
      )}
    </div>
  );
}
