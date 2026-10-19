import { useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { useDebounce } from '@/hooks/useDebounce';
import { useCustomerQuery, useCustomersQuery } from '../api/admin.api';
import { StatusBadge } from '../components/StatusBadge';

export default function CustomersPage() {
  const [q, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const search = useDebounce(q);
  const { data, isLoading, error, refetch } = useCustomersQuery({ q: search, page });
  return (
    <>
      <PageHeader
        title="Customers"
        description="Get to know the people who make your store possible."
      />
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={15} />
          <Input
            aria-label="Search customers"
            placeholder="Search by name or email…"
            value={q}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <span className="admin-toolbar-count">{data?.total ?? 0} customers</span>
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
              keyFor={(customer) => customer.id}
              empty="No customers match your search."
              columns={[
                {
                  key: 'name',
                  header: 'Customer',
                  render: (customer) => (
                    <div className="admin-product-cell">
                      <div className="admin-customer-avatar">
                        {customer.name
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <strong>{customer.name}</strong>
                        <small>{customer.email}</small>
                      </div>
                    </div>
                  ),
                },
                { key: 'joined', header: 'Joined', render: (customer) => date(customer.createdAt) },
                { key: 'orders', header: 'Orders', render: (customer) => customer.orderCount },
                {
                  key: 'spent',
                  header: 'Total spent',
                  render: (customer) => <strong>{money(customer.totalSpent)}</strong>,
                },
                {
                  key: 'profile',
                  header: 'Profile',
                  render: (customer) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View ${customer.name}`}
                      onClick={() => setSelected(customer.id)}
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
      {selected && <CustomerDetails id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CustomerDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useCustomerQuery(id);
  return (
    <Dialog
      open
      title={data?.customer.name ?? 'Customer profile'}
      description={data?.customer.email}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {isLoading ? (
        <LoadingSkeleton count={1} />
      ) : error || !data ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <>
          <div className="admin-detail-grid">
            <div className="admin-detail-card">
              <h3>Customer since {date(data.customer.createdAt)}</h3>
              <p>{data.customer.email}</p>
              <strong>
                {data.customer.orderCount} orders · {money(data.customer.totalSpent)} total spent
              </strong>
            </div>
            <div className="admin-detail-card">
              <h3>Saved addresses</h3>
              {data.customer.addresses.length ? (
                data.customer.addresses.map((address, index) => (
                  <p key={index}>
                    {address.name}
                    <br />
                    {address.line1}, {address.city}, {address.country}
                  </p>
                ))
              ) : (
                <p>No saved addresses.</p>
              )}
            </div>
          </div>
          <h3 style={{ margin: '24px 0 14px', fontSize: 13 }}>Purchase history</h3>
          <div className="admin-table">
            <DataTable
              rows={data.orders}
              keyFor={(order) => order.id}
              empty="This customer has not placed an order yet."
              columns={[
                {
                  key: 'order',
                  header: 'Order',
                  render: (order) => <strong>#{order.number}</strong>,
                },
                { key: 'date', header: 'Date', render: (order) => date(order.createdAt) },
                {
                  key: 'items',
                  header: 'Items',
                  render: (order) => (
                    <span
                      title={order.items
                        .map((item) => `${item.quantity} × ${item.name}`)
                        .join(', ')}
                    >
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (order) => <StatusBadge status={order.status} />,
                },
                { key: 'total', header: 'Total', render: (order) => money(order.totals.total) },
              ]}
            />
          </div>
        </>
      )}
    </Dialog>
  );
}
