import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Package,
  ShoppingBag,
  Users,
  TriangleAlert,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Order } from '@velora/contracts';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { useDashboardQuery } from '../api/admin.api';
import { StatusBadge } from '../components/StatusBadge';
import { exportCsv } from '../components/exportCsv';

const chartColors = ['#7e9270', '#b3c3a5', '#d3c3a2', '#9faec0', '#e4c1ae', '#cfcfcb', '#a1b5a6'];
const columns = [
  { key: 'number', header: 'Order', render: (order: Order) => <strong>#{order.number}</strong> },
  {
    key: 'customer',
    header: 'Customer',
    render: (order: Order) => (
      <>
        <strong>{order.address.name}</strong>
        <small>{order.email}</small>
      </>
    ),
  },
  { key: 'date', header: 'Date', render: (order: Order) => date(order.createdAt) },
  {
    key: 'payment',
    header: 'Payment',
    render: (order: Order) => <StatusBadge status={order.paymentStatus} />,
  },
  {
    key: 'status',
    header: 'Fulfillment',
    render: (order: Order) => <StatusBadge status={order.status} />,
  },
  {
    key: 'total',
    header: 'Total',
    render: (order: Order) => <strong>{money(order.totals.total)}</strong>,
  },
];

export default function DashboardPage({ analytics = false }: { analytics?: boolean }) {
  const { data, isLoading, error, refetch } = useDashboardQuery();
  const [period, setPeriod] = useState('30');
  if (isLoading) return <LoadingSkeleton count={4} />;
  if (error || !data) return <ErrorState error={error} retry={refetch} />;
  const trend = data.revenueTrend.slice(-Number(period));
  const periodRevenue = trend.reduce((total, point) => total + point.revenue, 0);
  const stats = [
    {
      label: 'Total revenue',
      value: money(data.revenue),
      icon: CircleDollarSign,
      note: 'From successful payments',
    },
    {
      label: 'Total orders',
      value: data.orderCount.toLocaleString(),
      icon: ShoppingBag,
      note: 'Across your store',
    },
    {
      label: 'Average order value',
      value: money(data.averageOrderValue),
      icon: Package,
      note: 'Per paid order',
    },
    {
      label: 'Total customers',
      value: data.customerCount.toLocaleString(),
      icon: Users,
      note: 'Registered customers',
    },
  ];
  const exportReport = () =>
    exportCsv(
      'velora-revenue.csv',
      ['Date', 'Revenue (USD cents)', 'Orders'],
      trend.map((point) => [point.date, point.revenue, point.orders]),
    );
  return (
    <>
      <PageHeader
        title={analytics ? 'Store analytics' : 'Your store, at a glance.'}
        description={
          analytics
            ? 'The numbers behind your business. Built from your persisted orders.'
            : 'Welcome back. Here’s what’s happening with your store today.'
        }
      >
        <Button variant="outline" size="sm" onClick={exportReport}>
          <ArrowDownToLine size={14} /> Export report
        </Button>
      </PageHeader>
      <div className="admin-stats">
        {stats.map(({ label, value, icon: Icon, note }) => (
          <div className="admin-stat" key={label}>
            <div className="admin-stat-top">
              {label}
              <Icon size={16} strokeWidth={1.5} />
            </div>
            <strong>{value}</strong>
            <small>
              <span>All time</span> · {note}
            </small>
          </div>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Revenue overview</h2>
              <p>{money(periodRevenue)} in the displayed period</p>
            </div>
            <Select
              aria-label="Revenue period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              style={{ width: 130, fontSize: 10, height: 32 }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          </div>
          <div
            className="admin-chart"
            role="img"
            aria-label={`Revenue chart for the last ${period} days`}
          >
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8a9c7b" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#8a9c7b" stopOpacity={0.015} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#eef0e9" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                    tickFormatter={(value) =>
                      new Date(String(value)).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={62}
                    tickFormatter={(value: number) => money(value)}
                  />
                  <Tooltip
                    formatter={(value) => [money(Number(value)), 'Revenue']}
                    labelFormatter={(value) => date(String(value))}
                    contentStyle={{ border: '1px solid #e5e8e0', borderRadius: 4, fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#839775"
                    strokeWidth={2}
                    fill="url(#revenue-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Revenue will appear here"
                description="Successful payments build your revenue history."
              />
            )}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Orders by status</h2>
              <p>A closer look at fulfillment</p>
            </div>
            <ShoppingBag size={15} color="#a1ab99" />
          </div>
          <div className="admin-pie-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.orderDistribution}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={52}
                  outerRadius={68}
                  paddingAngle={4}
                  stroke="none"
                >
                  {data.orderDistribution.map((entry, index) => (
                    <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ border: '1px solid #e5e8e0', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="admin-pie-label">
            <strong>{data.orderCount}</strong>Total orders
          </div>
          <div className="admin-distribution">
            {data.orderDistribution.map((item, index) => (
              <div className="admin-distribution-row" key={item.status}>
                <span
                  className="admin-distribution-dot"
                  style={{ background: chartColors[index % chartColors.length] }}
                />
                {item.status}
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      {data.lowStock.length > 0 && (
        <div className="admin-notice">
          <TriangleAlert size={17} />
          <span>
            <strong>{data.lowStock.length} variants are running low.</strong> A little attention
            keeps your store moving.
          </span>
          <Link to="/admin/inventory">
            Review inventory <ArrowUpRight size={12} style={{ display: 'inline' }} />
          </Link>
        </div>
      )}
      {analytics ? (
        <div className="admin-overview-grid">
          <BestSellers items={data.bestSellers} />
          <section className="admin-panel">
            <div className="admin-panel-header">
              <h2>Catalog health</h2>
            </div>
            <div className="admin-settings-body">
              <div className="admin-settings-line">
                <span>Products in catalog</span>
                <strong>{data.productCount}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Low stock variants</span>
                <strong>{data.lowStock.length}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Period orders</span>
                <strong>{trend.reduce((sum, point) => sum + point.orders, 0)}</strong>
              </div>
              <p>
                Revenue includes paid orders. Inventory and fulfillment totals update as your team
                makes changes.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Recent orders</h2>
              <p>Your latest customer purchases</p>
            </div>
            <Link to="/admin/orders">
              View all orders <ArrowRight size={13} />
            </Link>
          </div>
          <div className="admin-table">
            <DataTable
              columns={columns}
              rows={data.recentOrders}
              keyFor={(order) => order.id}
              empty="New orders will appear here."
            />
          </div>
        </section>
      )}
      {!analytics && (
        <div style={{ marginTop: 24 }}>
          <BestSellers items={data.bestSellers} />
        </div>
      )}
    </>
  );
}

function BestSellers({ items }: { items: { name: string; quantity: number; revenue: number }[] }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Best sellers</h2>
          <p>The pieces your customers love</p>
        </div>
        <Link to="/admin/products">
          Manage products <ArrowRight size={13} />
        </Link>
      </div>
      <div className="admin-best-sellers">
        {items.length ? (
          items.slice(0, 5).map((item, index) => (
            <div className="admin-best-seller" key={item.name}>
              <span className="rank">0{index + 1}</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.quantity} units sold</small>
              </div>
              <span className="revenue">{money(item.revenue)}</span>
            </div>
          ))
        ) : (
          <p>Best sellers appear after your first paid orders.</p>
        )}
      </div>
    </section>
  );
}
