import type { FilterQuery } from 'mongoose';
import { ProductModel, type ProductRecord } from '../../models.js';
import { pageResult } from '../../http.js';
import { productDto } from '../../serializers.js';

const scalar = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.slice(0, 200) : undefined;
export function productFilter(
  query: Record<string, unknown>,
  admin = false,
): FilterQuery<ProductRecord> {
  const filter: FilterQuery<ProductRecord> = { ...(admin ? {} : { status: 'published' }) };
  for (const key of ['category', 'collection', 'gender'] as const) {
    const value = scalar(query[key]);
    if (value) filter[key] = value;
  }
  if (admin && ['draft', 'published', 'archived'].includes(scalar(query.status) ?? ''))
    filter.status = scalar(query.status);
  const search = scalar(query.q);
  if (search?.trim()) filter.$text = { $search: search.trim() };
  const minPrice = Number(scalar(query.minPrice));
  const maxPrice = Number(scalar(query.maxPrice));
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice))
    filter.price = {
      ...(Number.isFinite(minPrice) ? { $gte: Math.max(0, minPrice) } : {}),
      ...(Number.isFinite(maxPrice) ? { $lte: Math.max(0, maxPrice) } : {}),
    };
  const variant: Record<string, unknown> = {};
  const size = scalar(query.size),
    color = scalar(query.color);
  if (size) variant.size = size;
  if (color) variant.color = color;
  if (query.inStock === 'true') variant.stock = { $gt: 0 };
  if (Object.keys(variant).length) filter.variants = { $elemMatch: variant };
  return filter;
}
export async function listProducts(
  query: Record<string, unknown>,
  paging: { page: number; limit: number; skip: number },
  admin = false,
) {
  const { page, limit, skip } = paging;
  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1, _id: -1 },
    featured: { reviewCount: -1, createdAt: -1 },
    popular: { reviewCount: -1, rating: -1 },
    'price-asc': { price: 1, _id: 1 },
    'price-desc': { price: -1, _id: 1 },
    name: { name: 1 },
  };
  const sort = scalar(query.sort) ?? 'featured';
  const filter = productFilter(query, admin);
  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(Object.hasOwn(sortOptions, sort) ? sortOptions[sort] : sortOptions.featured)
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);
  return pageResult(products.map(productDto), total, page, limit);
}
