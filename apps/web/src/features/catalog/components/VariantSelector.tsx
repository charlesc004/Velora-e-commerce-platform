import type { ProductVariant } from '@velora/contracts';
export function VariantSelector({
  variants,
  selected,
  onChange,
}: {
  variants: ProductVariant[];
  selected: ProductVariant;
  onChange: (variant: ProductVariant) => void;
}): React.JSX.Element {
  const colors = [...new Map(variants.map((v) => [v.color, v.colorHex])).entries()];
  const sizes = variants.filter((v) => v.color === selected.color);
  return (
    <div className="variant-selector">
      <div className="variant-label">
        <span>Color</span>
        <span>{selected.color}</span>
      </div>
      <div className="color-options">
        {colors.map(([name, hex]) => (
          <button
            key={name}
            className={selected.color === name ? 'active' : ''}
            aria-label={`Color: ${name}`}
            aria-pressed={selected.color === name}
            style={{ '--swatch': hex } as React.CSSProperties}
            onClick={() =>
              onChange(
                variants.find((v) => v.color === name && v.size === selected.size) ||
                  variants.find((v) => v.color === name && v.stock > 0) ||
                  variants.find((v) => v.color === name)!,
              )
            }
          >
            <span />
          </button>
        ))}
      </div>
      <div className="variant-label">
        <span>Select a size</span>
        <span>{selected.size}</span>
      </div>
      <div className="size-options">
        {sizes.map((v) => (
          <button
            key={v.id}
            className={selected.id === v.id ? 'active' : ''}
            aria-pressed={selected.id === v.id}
            aria-label={`Size ${v.size}${v.stock === 0 ? ', out of stock' : ''}`}
            disabled={v.stock === 0}
            onClick={() => onChange(v)}
          >
            {v.size}
          </button>
        ))}
      </div>
    </div>
  );
}
