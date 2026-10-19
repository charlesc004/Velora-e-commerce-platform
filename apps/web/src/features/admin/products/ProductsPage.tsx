import { useState } from 'react';
import { Plus, Search, Pencil, Download, Archive, Globe } from 'lucide-react';
import type { Product } from '@velora/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { money } from '@/lib/utils/currency';
import { errorMessage } from '@/lib/utils/errors';
import { useDebounce } from '@/hooks/useDebounce';
import { useAdminProductsQuery, useSaveProductMutation } from '../api/admin.api';
import { StatusBadge } from '../components/StatusBadge';
import { exportCsv } from '../components/exportCsv';
import ProductEditor from './ProductEditor';

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const search = useDebounce(q);
  const { data, isLoading, error, refetch } = useAdminProductsQuery({ page, q: search, status });
  const [save, { isLoading: saving }] = useSaveProductMutation();
  const changeStatus = async (product: Product, next: Product['status']) => {
    try {
      await save({ id: product.id, data: { status: next } }).unwrap();
      toast.success(next === 'published' ? 'Product published' : 'Product archived');
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  };
  return (
    <>
      <PageHeader title="Products" description="A thoughtfully curated catalog, all in one place.">
        <Button onClick={() => setEditor('new')} size="sm">
          <Plus size={15} /> Add product
        </Button>
      </PageHeader>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <Input
            aria-label="Search products"
            placeholder="Search by product name or SKU…"
            value={q}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          aria-label="Product status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
        <span className="admin-toolbar-count">{data?.total ?? 0} products</span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Export current product page"
          disabled={!data?.items.length}
          onClick={() =>
            exportCsv(
              'velora-products.csv',
              ['Name', 'SKU', 'Price (USD cents)', 'Status', 'Stock'],
              (data?.items ?? []).map((product) => [
                product.name,
                product.sku,
                product.price,
                product.status,
                product.variants.reduce((total, variant) => total + variant.stock, 0),
              ]),
            )
          }
        >
          <Download size={15} />
        </Button>
      </div>
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <>
          <section className="admin-panel admin-table">
            <DataTable
              rows={data?.items ?? []}
              keyFor={(product) => product.id}
              empty="No products match your search. Add a product to get started."
              columns={[
                {
                  key: 'name',
                  header: 'Product',
                  render: (product) => (
                    <div className="admin-product-cell">
                      <img src={product.images[0]} alt="" />
                      <div>
                        <strong>{product.name}</strong>
                        <small>{product.sku}</small>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (product) => (
                    <span style={{ textTransform: 'capitalize' }}>{product.category}</span>
                  ),
                },
                {
                  key: 'price',
                  header: 'Price',
                  render: (product) => <strong>{money(product.price)}</strong>,
                },
                {
                  key: 'stock',
                  header: 'Inventory',
                  render: (product) => (
                    <>
                      {product.variants.reduce((total, variant) => total + variant.stock, 0)} in
                      stock<small>{product.variants.length} variants</small>
                    </>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (product) => <StatusBadge status={product.status} />,
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (product) => (
                    <div className="admin-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${product.name}`}
                        onClick={() => setEditor(product)}
                      >
                        <Pencil size={14} />
                      </Button>
                      {product.status !== 'published' ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={saving}
                          aria-label={`Publish ${product.name}`}
                          onClick={() => changeStatus(product, 'published')}
                        >
                          <Globe size={14} />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={saving}
                          aria-label={`Archive ${product.name}`}
                          onClick={() => changeStatus(product, 'archived')}
                        >
                          <Archive size={14} />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </section>
          <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />
        </>
      )}
      {editor && (
        <ProductEditor
          product={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
