import type { Product, CartItem } from '@velora/contracts';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { useCartQuery, useSetCartMutation } from '../api/cart.api';
import { guestCartActions } from '../cart.slice';
export function useCart(): {
  items: CartItem[];
  count: number;
  loading: boolean;
  busy: boolean;
  error: unknown;
  add: (product: Product, variantId: string, quantity?: number) => Promise<void>;
  update: (productId: string, variantId: string, quantity: number) => Promise<void>;
} {
  const { data: user, isLoading: restoring } = useMeQuery();
  const server = useCartQuery(undefined, { skip: !user });
  const guest = useAppSelector((s) => s.guestCart.items);
  const dispatch = useAppDispatch();
  const [setCart, state] = useSetCartMutation();
  const items = user ? server.data?.items || [] : guest;
  async function add(product: Product, variantId: string, quantity = 1): Promise<void> {
    if (!user) {
      dispatch(guestCartActions.add({ productId: product.id, product, variantId, quantity }));
      return;
    }
    const lines = items.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    }));
    const existing = lines.find((i) => i.productId === product.id && i.variantId === variantId);
    if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
    else lines.push({ productId: product.id, variantId, quantity });
    await setCart({ items: lines }).unwrap();
  }
  async function update(productId: string, variantId: string, quantity: number): Promise<void> {
    if (!user) {
      dispatch(guestCartActions.update({ productId, variantId, quantity }));
      return;
    }
    await setCart({
      items: items
        .map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.productId === productId && i.variantId === variantId ? quantity : i.quantity,
        }))
        .filter((i) => i.quantity > 0),
    }).unwrap();
  }
  return {
    items,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    loading: restoring || (!!user && server.isLoading),
    busy: state.isLoading,
    error: server.error,
    add,
    update,
  };
}
