import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Product } from '@velora/contracts';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { errorMessage } from '@/lib/utils/errors';
import {
  useAddWishlistMutation,
  useRemoveWishlistMutation,
  useWishlistQuery,
} from './wishlist.api';

export function useWishlist(): {
  isSaved: (id: string) => boolean;
  toggle: (product: Product) => Promise<void>;
  pending: boolean;
} {
  const { data: user } = useMeQuery();
  const { data: products = [] } = useWishlistQuery(undefined, { skip: !user });
  const [add, adding] = useAddWishlistMutation();
  const [remove, removing] = useRemoveWishlistMutation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSaved = (id: string): boolean => products.some((product) => product.id === id);
  async function toggle(product: Product): Promise<void> {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    try {
      const saved = isSaved(product.id);
      await (saved ? remove(product.id) : add(product.id)).unwrap();
      toast.success(saved ? 'Removed from your wishlist' : 'Saved for a little later');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return { isSaved, toggle, pending: adding.isLoading || removing.isLoading };
}
