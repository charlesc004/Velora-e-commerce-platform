import { Router } from 'express';
import {
  productSchema,
  taxonomySchema,
  couponSchema,
  inventoryAdjustmentSchema,
  orderUpdateSchema,
} from '@velora/contracts';
import { AppError, data, parse, objectId, parameter, pagination, pageResult } from '../http.js';
import {
  CategoryModel,
  CollectionModel,
  CouponModel,
  MovementModel,
  OrderModel,
  ProductModel,
  UserModel,
} from '../models.js';
import { couponDto, movementDto, orderDto, productDto, taxonomyDto } from '../serializers.js';
import { requireAuth, requireAdmin, currentUser } from './auth.js';
import { listProducts } from './catalog/catalog.service.js';
import { createProduct, updateProduct, adjustInventory } from './catalog/product.service.js';
import { dashboard, customerSummaries, customerSummary } from './analytics.js';
import { checkoutOptions, expireReservations, updateOrderStatus } from './commerce.js';

const search = (value: unknown): RegExp | undefined =>
  typeof value === 'string' && value.trim()
    ? new RegExp(
        value
          .trim()
          .slice(0, 100)
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      )
    : undefined;
export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);
adminRoutes.get('/dashboard', async (_req, res) => {
  await expireReservations();
  data(res, await dashboard());
});
adminRoutes.get('/analytics', async (_req, res) => data(res, await dashboard()));
adminRoutes.get('/products', async (req, res) =>
  data(res, await listProducts(req.query, pagination(req), true)),
);
adminRoutes.get('/products/:id', async (req, res) => {
  const product = await ProductModel.findById(objectId(parameter(req, 'id')));
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  data(res, productDto(product));
});
adminRoutes.post('/products', async (req, res) => {
  const input = parse(productSchema, req.body);
  data(res, await createProduct(input, currentUser(req).id), 201);
});
adminRoutes.patch('/products/:id', async (req, res) => {
  data(res, await updateProduct(objectId(parameter(req, 'id')), req.body, currentUser(req).id));
});
adminRoutes.delete('/products/:id', async (req, res) => {
  const product = await ProductModel.findByIdAndUpdate(
    objectId(parameter(req, 'id')),
    { $set: { status: 'archived' } },
    { new: true },
  );
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  data(res, productDto(product));
});

adminRoutes.get('/inventory', async (req, res) => {
  const query = search(req.query.q);
  const products = await ProductModel.find({
    status: { $ne: 'archived' },
    ...(query ? { $or: [{ name: query }, { sku: query }, { 'variants.sku': query }] } : {}),
  })
    .sort({ name: 1 })
    .limit(100)
    .lean();
  const movements = await MovementModel.find().sort({ createdAt: -1 }).limit(100).lean();
  data(res, {
    items: products
      .flatMap((p) =>
        p.variants.map((v) => ({
          productId: String(p._id),
          name: p.name,
          variantId: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
      )
      .slice(0, 500),
    movements: movements.map(movementDto),
  });
});
adminRoutes.post('/inventory/adjustments', async (req, res) => {
  const input = parse(inventoryAdjustmentSchema, req.body);
  data(res, await adjustInventory(input, currentUser(req).id), 201);
});

adminRoutes.get('/orders', async (req, res) => {
  await expireReservations();
  const { page, limit, skip } = pagination(req);
  const query = search(req.query.q);
  const filter = {
    ...(query ? { $or: [{ number: query }, { email: query }] } : {}),
    ...(typeof req.query.status === 'string' ? { status: req.query.status } : {}),
  };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    OrderModel.countDocuments(filter),
  ]);
  data(res, pageResult(orders.map(orderDto), total, page, limit));
});
adminRoutes.get('/orders/:id', async (req, res) => {
  await expireReservations();
  const order = await OrderModel.findById(objectId(parameter(req, 'id')));
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  data(res, orderDto(order));
});
adminRoutes.patch('/orders/:id', async (req, res) => {
  const input = parse(orderUpdateSchema, req.body);
  const order = await updateOrderStatus(
    objectId(parameter(req, 'id')),
    input.status,
    input.trackingNumber,
  );
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  data(res, orderDto(order));
});
adminRoutes.get('/customers', async (req, res) => {
  const { page, limit, skip } = pagination(req),
    query = search(req.query.q);
  const filter = {
    role: 'customer',
    ...(query ? { $or: [{ name: query }, { email: query }] } : {}),
  };
  const [users, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);
  data(res, pageResult(await customerSummaries(users), total, page, limit));
});
adminRoutes.get('/customers/:id', async (req, res) => {
  const user = await UserModel.findById(objectId(parameter(req, 'id')));
  if (!user || user.role !== 'customer') throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  const orders = await OrderModel.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  data(res, { customer: await customerSummary(user), orders: orders.map(orderDto) });
});
adminRoutes.get('/coupons', async (_req, res) =>
  data(res, (await CouponModel.find().sort({ createdAt: -1 }).lean()).map(couponDto)),
);
adminRoutes.post('/coupons', async (req, res) =>
  data(res, couponDto(await CouponModel.create(parse(couponSchema, req.body))), 201),
);
adminRoutes.patch('/coupons/:id', async (req, res) => {
  const coupon = await CouponModel.findById(objectId(parameter(req, 'id')));
  if (!coupon) throw new AppError(404, 'NOT_FOUND', 'Discount not found');
  const input = parse(couponSchema, { ...couponDto(coupon), ...req.body });
  if (input.usageLimit < coupon.used)
    throw new AppError(422, 'COUPON_USAGE_LIMIT', 'Usage limit cannot be lower than existing uses');
  const updated = await CouponModel.findOneAndUpdate(
    { _id: coupon._id, used: { $lte: input.usageLimit } },
    { $set: input },
    { new: true },
  );
  if (!updated) throw new AppError(409, 'COUPON_CHANGED', 'This coupon changed. Please try again.');
  data(res, couponDto(updated));
});
adminRoutes.delete('/coupons/:id', async (req, res) => {
  const coupon = await CouponModel.findByIdAndUpdate(
    objectId(parameter(req, 'id')),
    { $set: { active: false } },
    { new: true },
  );
  if (!coupon) throw new AppError(404, 'NOT_FOUND', 'Discount not found');
  data(res, couponDto(coupon));
});

for (const [path, model, productField] of [
  ['categories', CategoryModel, 'category'],
  ['collections', CollectionModel, 'collection'],
] as const) {
  adminRoutes.get(`/${path}`, async (_req, res) =>
    data(res, (await model.find().sort({ name: 1 }).lean()).map(taxonomyDto)),
  );
  adminRoutes.post(`/${path}`, async (req, res) =>
    data(res, taxonomyDto(await model.create(parse(taxonomySchema, req.body))), 201),
  );
  adminRoutes.patch(`/${path}/:id`, async (req, res) => {
    const existing = await model.findById(objectId(parameter(req, 'id')));
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Record not found');
    const input = parse(taxonomySchema, { ...taxonomyDto(existing), ...req.body });
    if (
      input.slug !== existing.slug &&
      (await ProductModel.exists({ [productField]: existing.slug }))
    )
      throw new AppError(409, 'TAXONOMY_IN_USE', 'A slug used by products cannot be changed');
    existing.set(input);
    await existing.save();
    data(res, taxonomyDto(existing));
  });
  adminRoutes.delete(`/${path}/:id`, async (req, res) => {
    const existing = await model.findById(objectId(parameter(req, 'id')));
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Record not found');
    if (await ProductModel.exists({ [productField]: existing.slug }))
      throw new AppError(
        409,
        'TAXONOMY_IN_USE',
        'Move products to another category or collection before deleting',
      );
    await existing.deleteOne();
    data(res, { message: 'Deleted' });
  });
}
adminRoutes.get('/settings', (req, res) =>
  data(res, {
    storeName: 'VELORA',
    currency: 'USD',
    ...checkoutOptions,
    administrator: currentUser(req),
  }),
);
