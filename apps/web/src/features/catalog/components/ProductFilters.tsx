import type { Category, CatalogFacets } from '@velora/contracts';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
export function ProductFilters({
  params,
  setFilter,
  categories,
  facets,
}: {
  params: URLSearchParams;
  setFilter: (key: string, value: string) => void;
  categories: Category[];
  facets?: CatalogFacets;
}): React.JSX.Element {
  return (
    <div className="product-filters">
      <div className="filter-group">
        <h3>Category</h3>
        <button
          className={!params.get('category') ? 'selected' : ''}
          onClick={() => setFilter('category', '')}
        >
          All pieces
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={params.get('category') === c.slug ? 'selected' : ''}
            onClick={() => setFilter('category', c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="filter-group">
        <h3>Made for</h3>
        {[
          ['', 'Everyone'],
          ['women', 'Women'],
          ['men', 'Men'],
        ].map(([value, label]) => (
          <label className="check-label" key={label}>
            <input
              type="radio"
              name="gender"
              checked={(params.get('gender') || '') === value}
              onChange={() => setFilter('gender', value)}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h3>Size</h3>
        <div className="size-filter">
          {(facets?.sizes || []).map((size) => (
            <button
              key={size}
              className={params.get('size') === size ? 'selected' : ''}
              onClick={() => setFilter('size', params.get('size') === size ? '' : size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <h3>Color</h3>
        <Select
          aria-label="Filter by color"
          value={params.get('color') || ''}
          onChange={(e) => setFilter('color', e.target.value)}
        >
          <option value="">All colors</option>
          {(facets?.colors || []).map((color) => (
            <option key={color.name} value={color.name}>
              {color.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="filter-group">
        <h3>Price range</h3>
        <div className="price-filter">
          <Input
            type="number"
            min="0"
            placeholder="Min $"
            aria-label="Minimum price in dollars"
            value={params.get('minPrice') ? Number(params.get('minPrice')) / 100 : ''}
            onChange={(e) =>
              setFilter(
                'minPrice',
                e.target.value ? String(Math.round(Number(e.target.value) * 100)) : '',
              )
            }
          />
          <span>—</span>
          <Input
            type="number"
            min="0"
            placeholder="Max $"
            aria-label="Maximum price in dollars"
            value={params.get('maxPrice') ? Number(params.get('maxPrice')) / 100 : ''}
            onChange={(e) =>
              setFilter(
                'maxPrice',
                e.target.value ? String(Math.round(Number(e.target.value) * 100)) : '',
              )
            }
          />
        </div>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={params.get('inStock') === 'true'}
          onChange={(e) => setFilter('inStock', e.target.checked ? 'true' : '')}
        />
        In stock only
      </label>
      <Button variant="ghost" className="reset-filters" onClick={() => setFilter('reset', '')}>
        Reset filters
      </Button>
    </div>
  );
}
