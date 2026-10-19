import { Schema, model, Types } from 'mongoose';
import type {
  Address,
  CartLine,
  ProductInput,
  OrderItem,
  Totals,
  OrderStatus,
  CouponInput,
  ReviewInput,
} from '@velora/contracts';

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}
export interface UserRecord extends Timestamps {
  name: string;
  email: string;
  passwordHash: string;
  role: 'customer' | 'admin';
  addresses: Address[];
}
const addressSchema = new Schema<Address>(
  {
    name: String,
    line1: String,
    line2: String,
    city: String,
    region: String,
    postalCode: String,
    country: String,
  },
  { _id: false },
);
const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);
export const UserModel = model<UserRecord>('User', userSchema);

export interface SessionRecord extends Timestamps {
  userId: Types.ObjectId;
  refreshHash: string;
  previousRefreshHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
}
const sessionSchema = new Schema<SessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshHash: { type: String, required: true, unique: true },
    previousRefreshHash: String,
    expiresAt: { type: Date, required: true, expires: 0 },
    revokedAt: Date,
  },
  { timestamps: true },
);
export const SessionModel = model<SessionRecord>('Session', sessionSchema);

export interface ProductRecord extends ProductInput, Timestamps {
  currency: 'USD';
  rating: number;
  reviewCount: number;
}
const variantSchema = new Schema(
  {
    id: { type: String, required: true },
    sku: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    colorHex: { type: String, required: true },
    stock: { type: Number, min: 0, required: true },
  },
  { _id: false },
);
const productSchema = new Schema<ProductRecord>(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    sku: { type: String, unique: true, required: true },
    description: String,
    category: { type: String, index: true },
    collection: { type: String, index: true },
    gender: String,
    images: [String],
    price: { type: Number, min: 0, required: true },
    compareAtPrice: { type: Number, default: null },
    status: { type: String, enum: ['draft', 'published', 'archived'], index: true },
    tags: [String],
    variants: [variantSchema],
    currency: { type: String, default: 'USD' },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
export const ProductModel = model<ProductRecord>('Product', productSchema);

export interface TaxonomyRecord extends Timestamps {
  name: string;
  slug: string;
  image: string;
  description: string;
}
const taxonomySchema = () =>
  new Schema<TaxonomyRecord>(
    {
      name: { type: String, required: true },
      slug: { type: String, unique: true, required: true },
      image: String,
      description: String,
    },
    { timestamps: true },
  );
export const CategoryModel = model<TaxonomyRecord>('Category', taxonomySchema());
export const CollectionModel = model<TaxonomyRecord>('Collection', taxonomySchema());

export interface CartRecord {
  userId: Types.ObjectId;
  items: CartLine[];
}
const lineSchema = new Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, min: 1, max: 20, required: true },
  },
  { _id: false },
);
export const CartModel = model<CartRecord>(
  'Cart',
  new Schema<CartRecord>(
    { userId: { type: Schema.Types.ObjectId, unique: true, required: true }, items: [lineSchema] },
    { timestamps: true },
  ),
);
export const WishlistModel = model<{ userId: Types.ObjectId; productIds: string[] }>(
  'Wishlist',
  new Schema(
    { userId: { type: Schema.Types.ObjectId, unique: true, required: true }, productIds: [String] },
    { timestamps: true },
  ),
);

export interface OrderRecord extends Timestamps {
  number: string;
  userId?: Types.ObjectId;
  guestTokenHash?: string;
  email: string;
  address: Address;
  items: OrderItem[];
  totals: Totals;
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'mock' | 'stripe';
  shippingMethod: 'standard' | 'express';
  trackingNumber?: string;
  expiresAt?: Date;
  idempotencyKey: string;
  requestHash: string;
  couponId?: Types.ObjectId;
  reservationReleased: boolean;
  stripeSessionId?: string;
}
const orderSchema = new Schema<OrderRecord>(
  {
    number: { type: String, unique: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestTokenHash: { type: String, select: false },
    email: String,
    address: Schema.Types.Mixed,
    items: [Schema.Types.Mixed],
    totals: Schema.Types.Mixed,
    status: { type: String, index: true, required: true },
    paymentStatus: { type: String, required: true },
    paymentMethod: String,
    shippingMethod: String,
    trackingNumber: String,
    expiresAt: { type: Date, index: true },
    idempotencyKey: { type: String, unique: true, required: true },
    requestHash: { type: String, required: true },
    couponId: Schema.Types.ObjectId,
    reservationReleased: { type: Boolean, default: false },
    stripeSessionId: String,
  },
  { timestamps: true },
);
orderSchema.index({ createdAt: -1 });
export const OrderModel = model<OrderRecord>('Order', orderSchema);

export interface ReservationRecord {
  orderId: Types.ObjectId;
  productId: string;
  variantId: string;
  quantity: number;
  status: 'held' | 'consumed' | 'released';
  expiresAt: Date;
}
const reservationSchema = new Schema<ReservationRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, index: true, required: true },
    productId: String,
    variantId: String,
    quantity: Number,
    status: { type: String, enum: ['held', 'consumed', 'released'] },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);
export const ReservationModel = model<ReservationRecord>('InventoryReservation', reservationSchema);

export interface MovementRecord extends Timestamps {
  productId: string;
  variantId: string;
  delta: number;
  reason: string;
  actorId?: string;
  orderId?: string;
}
export const MovementModel = model<MovementRecord>(
  'InventoryMovement',
  new Schema<MovementRecord>(
    {
      productId: { type: String, index: true },
      variantId: String,
      delta: Number,
      reason: String,
      actorId: String,
      orderId: String,
    },
    { timestamps: true },
  ),
);

export interface CouponRecord extends CouponInput, Timestamps {
  used: number;
}
export const CouponModel = model<CouponRecord>(
  'Coupon',
  new Schema<CouponRecord>(
    {
      code: { type: String, required: true, unique: true },
      type: { type: String, enum: ['percentage', 'fixed'] },
      value: Number,
      minimum: Number,
      usageLimit: Number,
      active: Boolean,
      expiresAt: { type: String, default: null },
      used: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);

export interface ReviewRecord extends ReviewInput, Timestamps {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  name: string;
  verified: boolean;
}
const reviewSchema = new Schema<ReviewRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    name: String,
    rating: Number,
    title: String,
    body: String,
    verified: Boolean,
  },
  { timestamps: true },
);
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
export const ReviewModel = model<ReviewRecord>('Review', reviewSchema);

export interface PaymentRecord extends Timestamps {
  orderId: Types.ObjectId;
  provider: 'mock' | 'stripe';
  providerId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'refunded';
}
export const PaymentModel = model<PaymentRecord>(
  'Payment',
  new Schema<PaymentRecord>(
    {
      orderId: { type: Schema.Types.ObjectId, index: true },
      provider: String,
      providerId: { type: String, unique: true },
      amount: Number,
      currency: String,
      status: String,
    },
    { timestamps: true },
  ),
);
export const PaymentEventModel = model<{ eventId: string; type: string; orderId?: string }>(
  'PaymentEvent',
  new Schema(
    { eventId: { type: String, unique: true, required: true }, type: String, orderId: String },
    { timestamps: true },
  ),
);
export const NewsletterModel = model<{ email: string }>(
  'NewsletterSubscription',
  new Schema({ email: { type: String, unique: true, required: true } }, { timestamps: true }),
);

export async function initializeIndexes(): Promise<void> {
  await Promise.all(
    [
      UserModel,
      SessionModel,
      ProductModel,
      CategoryModel,
      CollectionModel,
      CartModel,
      WishlistModel,
      OrderModel,
      ReservationModel,
      MovementModel,
      CouponModel,
      ReviewModel,
      PaymentModel,
      PaymentEventModel,
      NewsletterModel,
    ].map((model) => model.init()),
  );
}
