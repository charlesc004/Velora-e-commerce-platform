import { Link } from 'react-router-dom';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { useWishlistQuery } from './wishlist.api';
import { ProductGrid } from '@/features/catalog/components/ProductGrid';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { usePageMeta } from '@/hooks/usePageMeta';
export default function WishlistPage(): React.JSX.Element {
  const { data: user, isLoading } = useMeQuery();
  const result = useWishlistQuery(undefined, { skip: !user });
  usePageMeta('Your wishlist');
  return (
    <div className="container section">
      <PageHeader
        eyebrow="SOMETHING FOR LATER"
        title="The pieces on your mind."
        description="A considered collection of your own."
      />
      {isLoading || result.isLoading ? (
        <LoadingSkeleton />
      ) : !user ? (
        <EmptyState
          title="Good things are worth saving."
          description="Sign in to keep all your favorites in one place."
        >
          <Button asChild>
            <Link to="/login?redirect=/wishlist">Sign in</Link>
          </Button>
        </EmptyState>
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.refetch} />
      ) : result.data?.length ? (
        <ProductGrid products={result.data} />
      ) : (
        <EmptyState
          title="Room for a few favorites."
          description="Save the pieces you love. Come back when the time feels right."
        >
          <Button asChild>
            <Link to="/shop">Explore the collection</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
