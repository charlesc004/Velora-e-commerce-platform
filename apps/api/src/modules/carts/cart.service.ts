import type { Cart, CartLine } from '@velora/contracts';
import { CartModel, ProductModel } from '../../models.js';
import { AppError, objectId } from '../../http.js';
import { productDto } from '../../serializers.js';

export function normalizeLines(lines: CartLine[]): CartLine[] {
  const merged = new Map<string, CartLine>();
  for (const line of lines) {
    objectId(line.productId);
    const key = `${line.productId}:${line.variantId}`;
    const previous = merged.get(key);
    // Mongoose subdocuments expose fields through getters, so a spread loses their public fields.
    merged.set(key, {
      productId: line.productId,
      variantId: line.variantId,
      quantity: Math.min(20, (previous?.quantity ?? 0) + line.quantity),
    });
  }
  if (merged.size > 50)
    throw new AppError(422, 'CART_LIMIT', 'Your bag can contain up to 50 distinct items');
  return [...merged.values()];
}
export async function hydrateCart(
  items: CartLine[],
  mode: 'display' | 'validate' | 'merge' = 'display',
): Promise<Cart> {
  const normalized = normalizeLines(items);
  const products = await ProductModel.find({
    _id: { $in: normalized.map((i) => i.productId) },
  }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const hydrated: Cart['items'] = [];
  for (const line of normalized) {
    const product = byId.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (
      !product ||
      (mode !== 'display' && (product.status !== 'published' || !variant || variant.stock < 1))
    ) {
      if (mode === 'validate')
        throw new AppError(409, 'ITEM_UNAVAILABLE', 'An item in your bag is no longer available');
      continue;
    }
    if (mode === 'validate' && variant && line.quantity > variant.stock)
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Only ${variant.stock} units of ${product.name} are available`,
      );
    hydrated.push({
      ...line,
      quantity: mode === 'merge' ? Math.min(line.quantity, variant?.stock ?? 0) : line.quantity,
      product: productDto(product),
    });
  }
  return { items: hydrated };
}

export async function saveCart(
  userId: string,
  items: CartLine[],
  mode: 'validate' | 'merge',
): Promise<Cart> {
  const cart = await hydrateCart(items, mode);
  await CartModel.updateOne(
    { userId },
    {
      $set: {
        items: cart.items.map(({ productId, variantId, quantity }) => ({
          productId,
          variantId,
          quantity,
        })),
      },
    },
    { upsert: true },
  );
  return cart;
}
