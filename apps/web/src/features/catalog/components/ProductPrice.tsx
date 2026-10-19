import type { Product } from '@velora/contracts';
import { money } from '@/lib/utils/currency';

export function ProductPrice({
  price,
  compareAtPrice,
}: Pick<Product, 'price' | 'compareAtPrice'>): React.JSX.Element {
  return (
    <>
      <span>{money(price)}</span>
      {compareAtPrice !== null && compareAtPrice > price && <s>{money(compareAtPrice)}</s>}
    </>
  );
}
