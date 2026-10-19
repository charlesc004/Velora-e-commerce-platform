import type {
  Product,
  User,
  Order,
  Category,
  Coupon,
  Review,
  InventoryMovement,
} from '@velora/contracts';
import type { Types } from 'mongoose';
import type {
  ProductRecord,
  UserRecord,
  OrderRecord,
  TaxonomyRecord,
  CouponRecord,
  ReviewRecord,
  MovementRecord,
} from './models.js';

type Identified<T> = T & { _id: Types.ObjectId };
export function userDto(user: Identified<UserRecord>): User {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    addresses: user.addresses,
    createdAt: user.createdAt.toISOString(),
  };
}
export function productDto(product: Identified<ProductRecord>): Product {
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    category: product.category,
    collection: product.collection,
    gender: product.gender,
    images: [...product.images],
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    status: product.status,
    tags: [...product.tags],
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      stock: v.stock,
    })),
    currency: 'USD',
    rating: product.rating,
    reviewCount: product.reviewCount,
    createdAt: product.createdAt.toISOString(),
  };
}
export function orderDto(order: Identified<OrderRecord>): Order {
  return {
    id: String(order._id),
    number: order.number,
    ...(order.userId ? { userId: String(order.userId) } : {}),
    email: order.email,
    address: order.address,
    items: order.items,
    totals: order.totals,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    shippingMethod: order.shippingMethod,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt?.toISOString(),
  };
}
export function taxonomyDto(value: Identified<TaxonomyRecord>): Category {
  return {
    id: String(value._id),
    name: value.name,
    slug: value.slug,
    image: value.image,
    description: value.description,
  };
}
export function couponDto(value: Identified<CouponRecord>): Coupon {
  return {
    id: String(value._id),
    code: value.code,
    type: value.type,
    value: value.value,
    minimum: value.minimum,
    usageLimit: value.usageLimit,
    active: value.active,
    expiresAt: value.expiresAt,
    used: value.used,
  };
}
export function reviewDto(value: Identified<ReviewRecord>): Review {
  return {
    id: String(value._id),
    rating: value.rating,
    title: value.title,
    body: value.body,
    name: value.name,
    verified: value.verified,
    createdAt: value.createdAt.toISOString(),
  };
}
export function movementDto(value: Identified<MovementRecord>): InventoryMovement {
  return {
    id: String(value._id),
    productId: value.productId,
    variantId: value.variantId,
    delta: value.delta,
    reason: value.reason,
    actorId: value.actorId,
    createdAt: value.createdAt.toISOString(),
  };
}
