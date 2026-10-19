import { Router } from 'express';
import { Types } from 'mongoose';
import { reviewSchema, newsletterSchema } from '@velora/contracts';
import {
  ProductModel,
  CategoryModel,
  CollectionModel,
  ReviewModel,
  OrderModel,
  NewsletterModel,
} from '../models.js';
import { AppError, data, objectId, parameter, pagination, parse } from '../http.js';
import { productDto, taxonomyDto, reviewDto } from '../serializers.js';
import { requireAuth, currentUser } from './auth.js';
import { listProducts } from './catalog/catalog.service.js';

export const catalogRoutes = Router();
catalogRoutes.get('/products', async (req, res) =>
  data(res, await listProducts(req.query, pagination(req))),
);
catalogRoutes.get('/products/facets', async (_req, res) => {
  const [facets] = await ProductModel.aggregate<{
    sizes: string[];
    colors: { name: string; hex: string }[];
  }>([
    { $match: { status: 'published' } },
    { $unwind: '$variants' },
    {
      $group: {
        _id: null,
        sizes: { $addToSet: '$variants.size' },
        colors: { $addToSet: { name: '$variants.color', hex: '$variants.colorHex' } },
      },
    },
    { $project: { _id: 0, sizes: 1, colors: 1 } },
  ]);
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  data(res, {
    sizes: (facets?.sizes ?? []).sort((a, b) => {
      const ai = sizeOrder.indexOf(a),
        bi = sizeOrder.indexOf(b);
      return ai >= 0 && bi >= 0
        ? ai - bi
        : ai >= 0
          ? -1
          : bi >= 0
            ? 1
            : a.localeCompare(b, undefined, { numeric: true });
    }),
    colors: (facets?.colors ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  });
});
catalogRoutes.get('/products/:id/reviews', async (req, res) => {
  const id = objectId(parameter(req, 'id'));
  const exists = await ProductModel.exists({ _id: id, status: 'published' });
  if (!exists) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  data(
    res,
    (await ReviewModel.find({ productId: id }).sort({ createdAt: -1 }).limit(100).lean()).map(
      reviewDto,
    ),
  );
});
catalogRoutes.post('/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = objectId(parameter(req, 'id'));
  if (!(await ProductModel.exists({ _id: productId, status: 'published' })))
    throw new AppError(404, 'NOT_FOUND', 'Product not found');
  const input = parse(reviewSchema, req.body);
  const user = currentUser(req);
  const verified = Boolean(
    await OrderModel.exists({
      userId: user.id,
      paymentStatus: 'paid',
      'items.productId': productId,
    }),
  );
  const review = await ReviewModel.create({
    ...input,
    productId,
    userId: user.id,
    name: user.name,
    verified,
  });
  const [rating] = await ReviewModel.aggregate<{ rating: number; count: number }>([
    { $match: { productId: new Types.ObjectId(productId) } },
    { $group: { _id: '$productId', rating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await ProductModel.updateOne(
    { _id: productId },
    {
      $set: {
        rating: Math.round((rating?.rating ?? 0) * 10) / 10,
        reviewCount: rating?.count ?? 0,
      },
    },
  );
  data(res, reviewDto(review), 201);
});
catalogRoutes.get('/products/:slug', async (req, res) => {
  const product = await ProductModel.findOne({
    slug: parameter(req, 'slug'),
    status: 'published',
  }).lean();
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  data(res, productDto(product));
});
catalogRoutes.get('/categories', async (_req, res) =>
  data(res, (await CategoryModel.find().sort({ name: 1 }).lean()).map(taxonomyDto)),
);
catalogRoutes.get('/collections', async (_req, res) =>
  data(res, (await CollectionModel.find().sort({ name: 1 }).lean()).map(taxonomyDto)),
);
catalogRoutes.post('/newsletter', async (req, res) => {
  const input = parse(newsletterSchema, req.body);
  await NewsletterModel.updateOne(
    { email: input.email },
    { $setOnInsert: input },
    { upsert: true },
  );
  data(res, { message: 'You are on the list. Welcome to VELORA.' });
});
