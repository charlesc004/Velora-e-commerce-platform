import { z } from 'zod';

export const CURRENCY = 'USD' as const;
export const shippingMethods = ['standard', 'express'] as const;
export interface CheckoutOptions {
  shipping: { standard: number; express: number; freeThreshold: number };
  taxRate: number;
  paymentMethods: ('mock' | 'stripe')[];
}
export const orderStatuses = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'expired',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).default(''),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().length(2).default('US'),
});
export type Address = z.infer<typeof addressSchema>;
export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
});
export type LoginInput = z.infer<typeof loginSchema>;
export const newsletterSchema = loginSchema.pick({ email: true });
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  addresses: Address[];
  createdAt: string;
}

export const variantSchema = z.object({
  id: z.string().min(1).max(80),
  sku: z.string().min(1).max(100),
  size: z.string().min(1).max(30),
  color: z.string().min(1).max(40),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  stock: z.number().int().min(0).max(100000),
});
export type ProductVariant = z.infer<typeof variantSchema>;
export const productSchema = z
  .object({
    name: z.string().trim().min(3).max(140),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
    sku: z.string().min(2).max(80),
    description: z.string().trim().min(20).max(6000),
    category: z.string().min(1).max(80),
    collection: z.string().min(1).max(80),
    gender: z.enum(['women', 'men', 'unisex']),
    images: z
      .array(
        z
          .string()
          .max(1000)
          .refine(
            (v) => v.startsWith('/images/') || /^https:\/\//.test(v),
            'Use a local image path or HTTPS URL',
          ),
      )
      .min(1)
      .max(8),
    price: z.number().int().min(100).max(100000000),
    compareAtPrice: z.number().int().min(0).max(100000000).nullable().default(null),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    tags: z.array(z.string().max(40)).max(12).default([]),
    variants: z.array(variantSchema).min(1).max(60),
  })
  .refine((p) => new Set(p.variants.map((v) => v.id)).size === p.variants.length, {
    message: 'Variant IDs must be unique',
    path: ['variants'],
  });
export type ProductInput = z.infer<typeof productSchema>;
export interface Product extends ProductInput {
  id: string;
  currency: 'USD';
  rating: number;
  reviewCount: number;
  createdAt: string;
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
}
export type Collection = Category;
export interface CatalogFacets {
  sizes: string[];
  colors: { name: string; hex: string }[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string[]> };
}
export const cartLineSchema = z.object({
  productId: z.string().min(1).max(80),
  variantId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(20),
});
export type CartLine = z.infer<typeof cartLineSchema>;
export interface CartItem extends CartLine {
  product: Product;
}
export interface Cart {
  items: CartItem[];
}
export const cartItemsSchema = z.object({ items: z.array(cartLineSchema).max(50) });
export const previewSchema = cartItemsSchema.extend({
  shippingMethod: z.enum(shippingMethods).default('standard'),
  couponCode: z.string().trim().max(40).optional(),
});
export type PreviewInput = z.infer<typeof previewSchema>;
export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: 'USD';
  couponCode?: string;
}
export const checkoutSchema = previewSchema.extend({
  email: z.string().trim().email().toLowerCase(),
  address: addressSchema,
  paymentMethod: z.enum(['mock', 'stripe']).default('mock'),
  idempotencyKey: z.string().uuid(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
}
export interface Order {
  id: string;
  number: string;
  userId?: string;
  email: string;
  address: Address;
  items: OrderItem[];
  totals: Totals;
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'mock' | 'stripe';
  shippingMethod: 'standard' | 'express';
  trackingNumber?: string;
  createdAt: string;
  expiresAt?: string;
}
export interface CheckoutResult {
  order: Order;
  guestToken?: string;
}
export interface PaymentResult {
  order: Order;
  url?: string;
}
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(100),
  body: z.string().trim().min(10).max(2000),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
export interface Review extends ReviewInput {
  id: string;
  name: string;
  createdAt: string;
  verified: boolean;
}
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().int().positive(),
    minimum: z.number().int().nonnegative().default(0),
    usageLimit: z.number().int().positive().default(100),
    active: z.boolean().default(true),
    expiresAt: z.string().datetime().nullable().default(null),
  })
  .refine((c) => c.type !== 'percentage' || c.value <= 100, {
    message: 'Percentage must be at most 100',
    path: ['value'],
  });
export type CouponInput = z.infer<typeof couponSchema>;
export interface Coupon extends CouponInput {
  id: string;
  used: number;
}
export const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  delta: z
    .number()
    .int()
    .min(-10000)
    .max(10000)
    .refine((v) => v !== 0, 'Enter a nonzero adjustment'),
  reason: z.string().trim().min(3).max(300),
});
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
export interface InventoryMovement extends InventoryAdjustment {
  id: string;
  createdAt: string;
  actorId?: string;
}
export interface Dashboard {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  productCount: number;
  customerCount: number;
  lowStock: {
    productId: string;
    name: string;
    variantId: string;
    size: string;
    color: string;
    stock: number;
  }[];
  recentOrders: Order[];
  revenueTrend: { date: string; revenue: number; orders: number }[];
  bestSellers: { name: string; quantity: number; revenue: number }[];
  orderDistribution: { status: string; count: number }[];
}
export interface Customer extends User {
  orderCount: number;
  totalSpent: number;
}
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  addresses: z.array(addressSchema).max(8).optional(),
});
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: registerSchema.shape.password,
});
export const orderUpdateSchema = z.object({
  status: z.enum(orderStatuses),
  trackingNumber: z.string().trim().max(100).optional(),
});
export const taxonomySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  image: z.string().max(1000).default('/images/editorial.jpg'),
  description: z.string().trim().max(1000).default(''),
});
