import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryAdjustmentSchema, type InventoryAdjustment } from '@velora/contracts';
import { Search, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { date } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useInventoryHistoryQuery,
  useAdjustInventoryMutation,
  type InventoryRecord,
} from '../api/admin.api';

export default function InventoryPage() {
  const [q, setQuery] = useState('');
  const search = useDebounce(q);
  const [lowOnly, setLowOnly] = useState(false);
  const [selected, setSelected] = useState<InventoryRecord | null>(null);
  const { data, isLoading, error, refetch } = useInventoryHistoryQuery({ q: search });
  const items = data?.items ?? [];
  const lowStock = items.filter((item) => item.stock < 6);
  const rows = lowOnly ? lowStock : items;
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Keep your best pieces available. Every adjustment tells a story."
      />
      <div className="admin-notice">
        <TriangleAlert size={17} />
        <span>
          <strong>{lowStock.length} variants have five or fewer units available.</strong> Review and
          replenish before they sell out.
        </span>
      </div>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <Input
            aria-label="Search inventory"
            placeholder="Search products or SKU…"
            value={q}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button
          variant={lowOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setLowOnly((value) => !value)}
          aria-pressed={lowOnly}
        >
          <SlidersHorizontal size={14} /> Low stock only
        </Button>
        <span className="admin-toolbar-count">{rows.length} variants · up to 500 shown</span>
      </div>
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <section className="admin-panel admin-table">
          <DataTable
            rows={rows}
            keyFor={(item) => `${item.productId}-${item.variantId}`}
            empty="No inventory matches these filters."
            columns={[
              {
                key: 'product',
                header: 'Product',
                render: (item) => (
                  <>
                    <strong>{item.name}</strong>
                    <small>{item.sku}</small>
                  </>
                ),
              },
              {
                key: 'variant',
                header: 'Variant',
                render: (item) => (
                  <>
                    {item.color} / {item.size}
                  </>
                ),
              },
              {
                key: 'stock',
                header: 'Available units',
                render: (item) => (
                  <strong className={item.stock < 6 ? 'admin-low-stock' : undefined}>
                    {item.stock}
                  </strong>
                ),
              },
              {
                key: 'health',
                header: 'Stock level',
                render: (item) => (
                  <span
                    style={{
                      color: item.stock === 0 ? '#b06e60' : item.stock < 6 ? '#ac8f59' : '#7e9870',
                    }}
                  >
                    {item.stock === 0 ? 'Out of stock' : item.stock < 6 ? 'Low stock' : 'In stock'}
                  </span>
                ),
              },
              {
                key: 'adjust',
                header: 'Actions',
                render: (item) => (
                  <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                    Adjust stock
                  </Button>
                ),
              },
            ]}
          />
        </section>
      )}
      <section className="admin-panel" style={{ marginTop: 26 }}>
        <div className="admin-panel-header">
          <div>
            <h2>Inventory movement history</h2>
            <p>The last 100 stock adjustments and their reasons</p>
          </div>
        </div>
        <div className="admin-table">
          <DataTable
            rows={data?.movements ?? []}
            keyFor={(movement) => movement.id}
            empty="No inventory movements yet."
            columns={[
              { key: 'date', header: 'Date', render: (movement) => date(movement.createdAt) },
              {
                key: 'variant',
                header: 'Product / variant',
                render: (movement) => {
                  const item = items.find(
                    (record) =>
                      record.productId === movement.productId &&
                      record.variantId === movement.variantId,
                  );
                  return (
                    <>
                      <strong>{item?.name ?? movement.productId}</strong>
                      <small>{item ? `${item.color} / ${item.size}` : movement.variantId}</small>
                    </>
                  );
                },
              },
              {
                key: 'delta',
                header: 'Adjustment',
                render: (movement) => (
                  <strong style={{ color: movement.delta > 0 ? '#678a5e' : '#b07e66' }}>
                    {movement.delta > 0 ? '+' : ''}
                    {movement.delta}
                  </strong>
                ),
              },
              { key: 'reason', header: 'Reason', render: (movement) => movement.reason },
              {
                key: 'actor',
                header: 'Recorded by',
                render: (movement) =>
                  movement.actorId ? (
                    <span title={movement.actorId}>Team member · {movement.actorId.slice(-6)}</span>
                  ) : (
                    'System'
                  ),
              },
            ]}
          />
        </div>
      </section>
      {selected && <InventoryAdjustmentDialog item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function InventoryAdjustmentDialog({
  item,
  onClose,
}: {
  item: InventoryRecord;
  onClose: () => void;
}) {
  const [adjust, { isLoading }] = useAdjustInventoryMutation();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<InventoryAdjustment>({
    resolver: zodResolver(inventoryAdjustmentSchema),
    defaultValues: { productId: item.productId, variantId: item.variantId, delta: 0, reason: '' },
  });
  const delta = watch('delta');
  return (
    <Dialog
      open
      title="Adjust stock"
      description={`${item.name} · ${item.color} / ${item.size}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="admin-form"
        onSubmit={handleSubmit(async (data) => {
          try {
            await adjust(data).unwrap();
            toast.success('Inventory adjustment recorded');
            onClose();
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        })}
      >
        <div className="admin-detail-card">
          Current stock: <strong>{item.stock}</strong> units
          <br />
          After adjustment: <strong>
            {item.stock + (Number.isFinite(delta) ? delta : 0)}
          </strong>{' '}
          units
        </div>
        <Field
          label="Unit adjustment (positive to add, negative to remove)"
          error={errors.delta?.message}
        >
          <Input type="number" step="1" {...register('delta', { valueAsNumber: true })} />
        </Field>
        <Field label="Reason for adjustment" error={errors.reason?.message}>
          <Textarea
            rows={3}
            placeholder="e.g. New shipment received, damaged item…"
            {...register('reason')}
          />
        </Field>
        <p>
          Adjustments are saved to the inventory audit history. Checkout stock is validated by the
          server.
        </p>
        <div className="admin-form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || item.stock + delta < 0}>
            {isLoading ? 'Recording…' : 'Record adjustment'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
