import { useState } from 'react';
import { Search, Download, ArrowUpRight } from 'lucide-react';
import { orderStatuses, type Order } from '@velora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { useDebounce } from '@/hooks/useDebounce';
import { useAdminOrdersQuery } from '../api/admin.api';
import { StatusBadge } from '../components/StatusBadge';
import { exportCsv } from '../components/exportCsv';
import OrderDetails from './OrderDetails';

export default function OrdersPage() {
  const [q, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const search = useDebounce(q);
  const { data, isLoading, error, refetch } = useAdminOrdersQuery({ page, q: search, status });
  return (
    <>
      <PageHeader
        title="Orders"
        description="From first purchase to doorstep. Keep every order moving."
      >
        <Button
          size="sm"
          variant="outline"
          disabled={!data?.items.length}
          onClick={() =>
            exportCsv(
              'velora-orders.csv',
              ['Order', 'Customer', 'Email', 'Date', 'Status', 'Payment', 'Total (USD cents)'],
              (data?.items ?? []).map((order) => [
                order.number,
                order.address.name,
                order.email,
                order.createdAt,
                order.status,
                order.paymentStatus,
                order.totals.total,
              ]),
            )
          }
        >
          <Download size={14} /> Export this page
        </Button>
      </PageHeader>
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <Input
            aria-label="Search orders"
            placeholder="Search order number or customer email…"
            value={q}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          aria-label="Filter orders by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {orderStatuses.map((value) => (
            <option key={value} value={value}>
              {value[0].toUpperCase() + value.slice(1)}
            </option>
          ))}
        </Select>
        <span className="admin-toolbar-count">{data?.total ?? 0} orders</span>
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
              keyFor={(order) => order.id}
              empty="No orders match these filters."
              columns={[
                {
                  key: 'number',
                  header: 'Order',
                  render: (order) => <strong>#{order.number}</strong>,
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (order) => (
                    <>
                      <strong>{order.address.name}</strong>
                      <small>{order.email}</small>
                    </>
                  ),
                },
                { key: 'date', header: 'Placed', render: (order) => date(order.createdAt) },
                {
                  key: 'payment',
                  header: 'Payment',
                  render: (order) => <StatusBadge status={order.paymentStatus} />,
                },
                {
                  key: 'status',
                  header: 'Fulfillment',
                  render: (order) => <StatusBadge status={order.status} />,
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (order) => <strong>{money(order.totals.total)}</strong>,
                },
                {
                  key: 'actions',
                  header: 'Details',
                  render: (order) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View order ${order.number}`}
                      onClick={() => setSelected(order)}
                    >
                      <ArrowUpRight size={15} />
                    </Button>
                  ),
                },
              ]}
            />
          </section>
          <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />
        </>
      )}
      {selected && <OrderDetails order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
