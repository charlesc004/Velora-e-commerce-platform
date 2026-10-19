import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useProductsQuery, useCategoriesQuery, useCatalogFacetsQuery } from '../api/catalog.api';
import { ProductGrid } from '../components/ProductGrid';
import { ProductFilters } from '../components/ProductFilters';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { Dialog } from '@/components/ui/dialog';
import { usePageMeta } from '@/hooks/usePageMeta';
export default function ShopPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(params.get('q') || '');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { data: facets } = useCatalogFacetsQuery();
  const query = new URLSearchParams(params);
  query.set('limit', '12');
  const result = useProductsQuery(query.toString());
  const { data: categories = [] } = useCategoriesQuery();
  const title =
    params.get('collection') === 'autumn-edit'
      ? 'The autumn edit.'
      : params.get('collection') === 'everyday-essentials'
        ? 'The everyday essentials.'
        : params.get('gender') === 'women'
          ? 'The women’s collection.'
          : params.get('gender') === 'men'
            ? 'The men’s collection.'
            : 'A wardrobe, considered.';
  usePageMeta(
    title,
    'Explore thoughtfully crafted clothing, accessories, and essentials. Find your next favorite piece in the VELORA collection.',
  );
  const queryText = params.get('q') || '';
  useEffect(() => {
    setSearch(queryText);
  }, [queryText]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  function clearSearch(): void {
    clearTimeout(searchTimer.current);
    setSearch('');
    setParams({});
  }
  function updateSearch(value: string): void {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value.trim()) next.set('q', value.trim());
          else next.delete('q');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    }, 300);
  }
  function setFilter(key: string, value: string): void {
    if (key === 'reset') {
      clearSearch();
      return;
    }
    if (key === 'q') {
      clearTimeout(searchTimer.current);
      setSearch(value);
    }
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }
  const activeFilters = [...params.entries()].filter(([key]) => !['sort', 'page'].includes(key));
  return (
    <div className="container shop-page">
      <div className="shop-intro">
        <p className="eyebrow">THE VELORA COLLECTION</p>
        <h1>{title}</h1>
        <p>Good pieces. Great possibilities. Find what feels like you.</p>
      </div>
      <div className="shop-toolbar">
        <div className="shop-search">
          <Search size={18} />
          <Input
            aria-label="Search products"
            placeholder="Find your next favorite…"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
        </div>
        <div className="shop-toolbar-right">
          <span className="results-count">{result.data?.total ?? '…'} pieces</span>
          <Button
            variant="outline"
            className="mobile-filter-button"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={15} /> Filters
          </Button>
          <Select
            aria-label="Sort products"
            value={params.get('sort') || 'featured'}
            onChange={(e) => setFilter('sort', e.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest arrivals</option>
            <option value="popular">Most loved</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </Select>
        </div>
      </div>
      <div className="shop-body">
        <aside className="shop-sidebar" aria-label="Product filters">
          <ProductFilters
            params={params}
            setFilter={setFilter}
            categories={categories}
            facets={facets}
          />
        </aside>
        <div className="shop-results">
          {activeFilters.length > 0 && (
            <div className="active-filters">
              {activeFilters.map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => {
                    setFilter(key, '');
                    if (key === 'q') setSearch('');
                  }}
                >
                  {key === 'q'
                    ? `“${value}”`
                    : key.includes('Price')
                      ? `${key === 'minPrice' ? 'From' : 'Up to'} $${Number(value) / 100}`
                      : value.replaceAll('-', ' ')}
                  <X size={12} />
                </button>
              ))}
              <button onClick={clearSearch}>Clear all</button>
            </div>
          )}
          {result.isLoading || result.isFetching ? (
            <LoadingSkeleton count={6} />
          ) : result.error ? (
            <ErrorState error={result.error} retry={result.refetch} />
          ) : !result.data?.items.length ? (
            <EmptyState
              title="A little too specific?"
              description="Try a different search or give your filters some room."
            >
              <Button variant="outline" onClick={clearSearch}>
                Explore all pieces
              </Button>
            </EmptyState>
          ) : (
            <ProductGrid products={result.data.items} />
          )}
          <Pagination
            page={result.data?.page || 1}
            pages={result.data?.pages || 1}
            onChange={(page) => {
              setFilter('page', String(page));
              window.scrollTo({ top: 220, behavior: 'smooth' });
            }}
          />
        </div>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Find your fit">
        <ProductFilters
          params={params}
          setFilter={setFilter}
          categories={categories}
          facets={facets}
        />
        <Button onClick={() => setFiltersOpen(false)}>
          Show {result.data?.total ?? ''} pieces
        </Button>
      </Dialog>
    </div>
  );
}
