import { Types } from 'mongoose';
import type { Customer, Dashboard } from '@velora/contracts';
import { OrderModel, ProductModel, UserModel, type UserRecord } from '../models.js';
import { orderDto, userDto } from '../serializers.js';

type CustomerRecord = UserRecord & { _id: Types.ObjectId };

export async function customerSummaries(users: CustomerRecord[]): Promise<Customer[]> {
  if (!users.length) return [];
  const summaries = await OrderModel.aggregate<{
    _id: Types.ObjectId;
    count: number;
    total: number;
  }>([
    { $match: { userId: { $in: users.map((user) => user._id) } } },
    {
      $group: {
        _id: '$userId',
        count: { $sum: 1 },
        total: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totals.total', 0] } },
      },
    },
  ]);
  const byUser = new Map(summaries.map((summary) => [String(summary._id), summary]));
  return users.map((user) => {
    const summary = byUser.get(String(user._id));
    return { ...userDto(user), orderCount: summary?.count ?? 0, totalSpent: summary?.total ?? 0 };
  });
}

export async function customerSummary(user: CustomerRecord): Promise<Customer> {
  return (await customerSummaries([user]))[0];
}

export async function dashboard(): Promise<Dashboard> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 89);
  since.setUTCHours(0, 0, 0, 0);
  const [
    summaryRows,
    orderCount,
    productCount,
    customerCount,
    recent,
    products,
    trend,
    sellers,
    distribution,
  ] = await Promise.all([
    OrderModel.aggregate<{ revenue: number; count: number }>([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$totals.total' }, count: { $sum: 1 } } },
    ]),
    OrderModel.countDocuments(),
    ProductModel.countDocuments({ status: { $ne: 'archived' } }),
    UserModel.countDocuments({ role: 'customer' }),
    OrderModel.find().sort({ createdAt: -1 }).limit(8).lean(),
    ProductModel.find({ status: 'published', 'variants.stock': { $lte: 5 } })
      .select('name variants')
      .lean(),
    OrderModel.aggregate<{ _id: string; revenue: number; orders: number }>([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totals.total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    OrderModel.aggregate<{ _id: string; name: string; quantity: number; revenue: number }>([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 6 },
    ]),
    OrderModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const summary = summaryRows[0];
  const trendByDate = new Map(trend.map((row) => [row._id, row]));
  const revenueTrend = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const value = trendByDate.get(key);
    return { date: key, revenue: value?.revenue ?? 0, orders: value?.orders ?? 0 };
  });
  return {
    revenue: summary?.revenue ?? 0,
    orderCount,
    averageOrderValue: summary?.count ? Math.round(summary.revenue / summary.count) : 0,
    productCount,
    customerCount,
    recentOrders: recent.map(orderDto),
    lowStock: products
      .flatMap((product) =>
        product.variants
          .filter((variant) => variant.stock <= 5)
          .map((variant) => ({
            productId: String(product._id),
            name: product.name,
            variantId: variant.id,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          })),
      )
      .slice(0, 30),
    revenueTrend,
    bestSellers: sellers.map(({ name, quantity, revenue }) => ({ name, quantity, revenue })),
    orderDistribution: distribution.map((row) => ({ status: row._id, count: row.count })),
  };
}
