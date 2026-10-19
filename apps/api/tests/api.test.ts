import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Stripe from 'stripe';
import type { CheckoutInput, ProductInput } from '@velora/contracts';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_velora_fixture';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_velora_fixture';
  process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
  process.env.TRUST_PROXY_HOPS = '1';
});
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import {
  CategoryModel,
  CollectionModel,
  CouponModel,
  initializeIndexes,
  MovementModel,
  OrderModel,
  PaymentEventModel,
  PaymentModel,
  ProductModel,
  ReservationModel,
  UserModel,
} from '../src/models.js';
import { expireReservations } from '../src/modules/commerce.js';

const app = createApp();
let replicaSet: MongoMemoryReplSet;
let admin: ReturnType<typeof request.agent>;
let customer: ReturnType<typeof request.agent>;
let other: ReturnType<typeof request.agent>;
let passwordHash = '';
let productId = '';
const password = 'TestingPassword2026!';
const productInput: ProductInput = {
  name: 'Test Cashmere Knit',
  slug: 'test-cashmere-knit',
  sku: 'TEST-KNIT',
  description: 'A timeless and beautifully soft cashmere knit for everyday wear.',
  category: 'knitwear',
  collection: 'autumn-edit',
  gender: 'women',
  images: ['/images/knit.jpg'],
  price: 10000,
  compareAtPrice: null,
  status: 'published',
  tags: ['cashmere'],
  variants: [
    { id: 'oat-m', sku: 'TEST-OAT-M', size: 'M', color: 'Oatmeal', colorHex: '#C4B8A5', stock: 5 },
    { id: 'black-s', sku: 'TEST-BLK-S', size: 'S', color: 'Black', colorHex: '#000000', stock: 0 },
  ],
};
const checkout = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  items: [{ productId, variantId: 'oat-m', quantity: 1 }],
  shippingMethod: 'standard',
  email: 'guest@example.test',
  address: {
    name: 'Test Customer',
    line1: '123 Fictional Lane',
    line2: '',
    city: 'Portland',
    region: 'Oregon',
    postalCode: '97201',
    country: 'US',
  },
  paymentMethod: 'mock',
  idempotencyKey: randomUUID(),
  ...overrides,
});
const stock = async (): Promise<number> =>
  (await ProductModel.findById(productId))!.variants[0].stock;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await connectDatabase(replicaSet.getUri('velora_test'));
  await initializeIndexes();
  passwordHash = await argon2.hash(password);
}, 180000);
afterAll(async () => {
  await disconnectDatabase();
  if (replicaSet) await replicaSet.stop();
}, 30000);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
  await UserModel.create([
    { name: 'Admin Example', email: 'admin@example.test', passwordHash, role: 'admin' },
    { name: 'Customer Example', email: 'customer@example.test', passwordHash, role: 'customer' },
    { name: 'Other Example', email: 'other@example.test', passwordHash, role: 'customer' },
  ]);
  await CategoryModel.create({
    name: 'Knitwear',
    slug: 'knitwear',
    image: '/images/knit.jpg',
    description: '',
  });
  await CollectionModel.create({
    name: 'Autumn Edit',
    slug: 'autumn-edit',
    image: '/images/coat.jpg',
    description: '',
  });
  productId = String((await ProductModel.create(productInput))._id);
  admin = request.agent(app);
  customer = request.agent(app);
  other = request.agent(app);
  await Promise.all([
    admin.post('/api/v1/auth/login').send({ email: 'admin@example.test', password }).expect(200),
    customer
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password })
      .expect(200),
    other.post('/api/v1/auth/login').send({ email: 'other@example.test', password }).expect(200),
  ]);
});

describe('authentication, authorization and request boundaries', () => {
  it('partitions rate limits by the nearest forwarded client without trusting spoofed earlier hops', async () => {
    const remaining = async (forwarded: string) => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('X-Forwarded-For', forwarded)
        .expect(200);
      return Number(String(response.headers.ratelimit).match(/; r=(\d+)/)?.[1]);
    };
    const first = await remaining('192.0.2.1, 198.51.100.10');
    const sameClient = await remaining('192.0.2.2, 198.51.100.10');
    const otherClient = await remaining('192.0.2.1, 198.51.100.11');
    expect(first).toBe(9999);
    expect(sameClient).toBe(first - 1);
    expect(otherClient).toBe(first);
  });
  it('registers with an HttpOnly session and never exposes password hashes', async () => {
    const agent = request.agent(app);
    const registered = await agent
      .post('/api/v1/auth/register')
      .send({ name: 'New Customer', email: 'NEW@example.test', password })
      .expect(201);
    expect(registered.body.data).toMatchObject({ email: 'new@example.test', role: 'customer' });
    expect(JSON.stringify(registered.body)).not.toMatch(/password|refreshHash|token/i);
    expect(String(registered.headers['set-cookie'])).toContain('HttpOnly');
    await agent
      .get('/api/v1/auth/me')
      .expect(200)
      .expect((res) => expect(res.body.data.email).toBe('new@example.test'));
    await agent.post('/api/v1/auth/logout').send({}).expect(200);
    await agent
      .get('/api/v1/auth/me')
      .expect(200)
      .expect((res) => expect(res.body.data).toBeNull());
  });
  it('rotates refresh tokens and revokes a session when its previous token is reused', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const previous = cookies.find((c) => c.startsWith('velora_refresh='))!.split(';')[0];
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', previous)
      .send({})
      .expect(200);
    expect(String(refreshed.headers['set-cookie'])).not.toContain(previous);
    await request(app).post('/api/v1/auth/refresh').set('Cookie', previous).send({}).expect(401);
    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', refreshed.headers['set-cookie'] as unknown as string[])
      .expect(401);
  });
  it('changes the password, revokes other sessions and preserves the current session', async () => {
    const secondSession = request.agent(app);
    await secondSession
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password })
      .expect(200);
    await customer
      .post('/api/v1/users/password')
      .send({ currentPassword: 'wrong', newPassword: 'ChangedPassword2026!' })
      .expect(422);
    await customer
      .post('/api/v1/users/password')
      .send({ currentPassword: password, newPassword: 'ChangedPassword2026!' })
      .expect(200);
    await customer.get('/api/v1/orders').expect(200);
    await secondSession.get('/api/v1/orders').expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password: 'ChangedPassword2026!' })
      .expect(200);
  });
  it('rejects anonymous/admin access violations, incorrect passwords and hostile origins', async () => {
    await request(app).get('/api/v1/admin/dashboard').expect(401);
    await customer.get('/api/v1/admin/dashboard').expect(403);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password: 'incorrect' })
      .expect(401);
    await customer
      .patch('/api/v1/users/profile')
      .set('Origin', 'https://attacker.example')
      .send({ name: 'Malicious' })
      .expect(403);
    await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('email=x')
      .expect(415);
    await customer
      .patch('/api/v1/users/profile')
      .send({ name: 'Updated Customer', role: 'admin' })
      .expect(200);
    await customer
      .get('/api/v1/auth/me')
      .expect((res) => expect(res.body.data.role).toBe('customer'));
  });
});

describe('catalog, cart, wishlist and reviews', () => {
  it('exposes configured checkout methods and policy without exposing provider credentials', async () => {
    const options = await request(app).get('/api/v1/checkout/options').expect(200);
    expect(options.body.data).toEqual({
      shipping: { standard: 800, express: 1800, freeThreshold: 15000 },
      taxRate: 0.08,
      paymentMethods: ['mock', 'stripe'],
    });
    const settings = await admin.get('/api/v1/admin/settings').expect(200);
    expect(settings.body.data).toMatchObject(options.body.data);
  });
  it('treats inherited object properties as unsupported sorts instead of failing the catalog', async () => {
    for (const sort of ['constructor', '__proto__', 'toString']) {
      await request(app)
        .get(`/api/v1/products?sort=${sort}`)
        .expect(200)
        .expect((res) => expect(res.body.data.total).toBe(1));
    }
  });
  it('filters only published products with a matching in-stock variant, bounds pagination, and searches text', async () => {
    await ProductModel.create({
      ...productInput,
      name: 'Draft Knit',
      slug: 'draft-knit',
      sku: 'DRAFT',
      status: 'draft',
    });
    const found = await request(app)
      .get('/api/v1/products?q=cashmere&category=knitwear&size=M&inStock=true&limit=999')
      .expect(200);
    expect(found.body.data.items).toHaveLength(1);
    await request(app)
      .get('/api/v1/products?size=S&inStock=true')
      .expect((res) => expect(res.body.data.total).toBe(0));
    await request(app).get('/api/v1/products/draft-knit').expect(404);
    const drafts = await admin.get('/api/v1/admin/products?status=draft').expect(200);
    expect(drafts.body.data.items.map((item: { slug: string }) => item.slug)).toEqual([
      'draft-knit',
    ]);
  });
  it('replaces and merges persistent cart lines, clamps a guest merge to stock, and hydrates public products', async () => {
    await customer
      .put('/api/v1/cart')
      .send({ items: [{ productId, variantId: 'oat-m', quantity: 2 }] })
      .expect(200);
    const merged = await customer
      .post('/api/v1/cart/merge')
      .send({ items: [{ productId, variantId: 'oat-m', quantity: 4 }] })
      .expect(200);
    expect(merged.body.data.items[0].quantity).toBe(5);
    expect(merged.body.data.items[0].product.name).toBe(productInput.name);
    await customer.get('/api/v1/cart').expect((res) => expect(res.body.data.items).toHaveLength(1));
    await customer
      .put('/api/v1/cart')
      .send({ items: [{ productId, variantId: 'oat-m', quantity: 6 }] })
      .expect(409);
    await customer.put('/api/v1/cart').send({ items: [] }).expect(200);
    await customer.get('/api/v1/cart').expect((res) => expect(res.body.data.items).toHaveLength(0));
    await customer
      .post('/api/v1/cart/items')
      .send({ productId, variantId: 'oat-m', quantity: 2 })
      .expect(201);
    await customer
      .post('/api/v1/cart/items')
      .send({ productId, variantId: 'oat-m', quantity: 2 })
      .expect(201)
      .expect((res) => expect(res.body.data.items[0].quantity).toBe(4));
    await customer.delete('/api/v1/cart/items/oat-m').expect(200);
    await customer.get('/api/v1/cart').expect((res) => expect(res.body.data.items).toHaveLength(0));
  });
  it('keeps wishlists per user and enforces one review per product per customer', async () => {
    await customer.post(`/api/v1/wishlist/${productId}`).send({}).expect(200);
    await customer.get('/api/v1/wishlist').expect((res) => expect(res.body.data).toHaveLength(1));
    await other.get('/api/v1/wishlist').expect((res) => expect(res.body.data).toHaveLength(0));
    const review = {
      rating: 4,
      title: 'Beautiful quality',
      body: 'Soft fabric and an excellent everyday fit.',
    };
    await customer.post(`/api/v1/products/${productId}/reviews`).send(review).expect(201);
    await customer.post(`/api/v1/products/${productId}/reviews`).send(review).expect(409);
    await request(app)
      .get('/api/v1/products/test-cashmere-knit')
      .expect((res) => expect(res.body.data).toMatchObject({ rating: 4, reviewCount: 1 }));
    await customer.delete(`/api/v1/wishlist/${productId}`).expect(200);
  });
});

describe('transactional checkout and payments', () => {
  it('uses database prices and coupon rules rather than client totals', async () => {
    await CouponModel.create({
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minimum: 5000,
      usageLimit: 2,
      active: true,
      used: 0,
    });
    const response = await request(app)
      .post('/api/v1/checkout/preview')
      .send({ ...checkout({ couponCode: 'welcome10' }), total: 1 })
      .expect(200);
    expect(response.body.data).toMatchObject({
      subtotal: 10000,
      discount: 1000,
      shipping: 800,
      tax: 720,
      total: 10520,
    });
    await request(app)
      .post('/api/v1/checkout/preview')
      .send(checkout({ couponCode: 'MISSING' }))
      .expect(422);
    await request(app)
      .post('/api/v1/checkout/orders')
      .send(checkout({ items: [] }))
      .expect(422);
  });
  it('creates an immutable snapshot, reserves stock once across retries, and denies guest token guessing', async () => {
    const input = checkout();
    const first = await request(app).post('/api/v1/checkout/orders').send(input).expect(201);
    const retry = await request(app).post('/api/v1/checkout/orders').send(input).expect(201);
    expect(retry.body.data).toEqual(first.body.data);
    expect(await stock()).toBe(4);
    expect(await ReservationModel.countDocuments({ status: 'held' })).toBe(1);
    expect(await OrderModel.countDocuments()).toBe(1);
    const { order, guestToken } = first.body.data;
    await request(app).get(`/api/v1/orders/${order.id}`).expect(404);
    await request(app).get(`/api/v1/orders/${order.id}?token=incorrect`).expect(404);
    await request(app).get(`/api/v1/orders/${order.id}?token=${guestToken}`).expect(200);
    await request(app)
      .post('/api/v1/checkout/orders')
      .send({ ...input, email: 'changed@example.test' })
      .expect(409);
    await ProductModel.updateOne({ _id: productId }, { $set: { price: 99999, name: 'Renamed' } });
    const persisted = await request(app)
      .get(`/api/v1/orders/${order.id}?token=${guestToken}`)
      .expect(200);
    expect(persisted.body.data.items[0]).toMatchObject({
      unitPrice: 10000,
      name: productInput.name,
    });
  });
  it('cannot oversell the final unit under concurrent checkouts', async () => {
    await ProductModel.updateOne({ _id: productId }, { $set: { 'variants.0.stock': 1 } });
    const results = await Promise.all([
      request(app).post('/api/v1/checkout/orders').send(checkout()),
      request(app).post('/api/v1/checkout/orders').send(checkout()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stock()).toBe(0);
    expect(await OrderModel.countDocuments()).toBe(1);
  });
  it('consumes a successful mock payment once and restricts account order ownership', async () => {
    const created = await customer
      .post('/api/v1/checkout/orders')
      .send(checkout({ email: 'customer@example.test' }))
      .expect(201);
    const id = created.body.data.order.id;
    await other.get(`/api/v1/orders/${id}`).expect(404);
    await other.post('/api/v1/payments/mock').send({ orderId: id, outcome: 'success' }).expect(404);
    await customer
      .post('/api/v1/payments/mock')
      .send({ orderId: id, outcome: 'success' })
      .expect(200)
      .expect((res) => expect(res.body.data.order.paymentStatus).toBe('paid'));
    await customer
      .post('/api/v1/payments/mock')
      .send({ orderId: id, outcome: 'success' })
      .expect(200);
    expect(await PaymentModel.countDocuments()).toBe(1);
    expect(await ReservationModel.countDocuments({ status: 'consumed' })).toBe(1);
    expect(await stock()).toBe(4);
    await customer.get('/api/v1/orders').expect((res) => expect(res.body.data.total).toBe(1));
    await other.get('/api/v1/orders').expect((res) => expect(res.body.data.total).toBe(0));
  });
  it('preserves cart additions during payment and exposes unavailable lines for customer correction', async () => {
    const line = { productId, variantId: 'oat-m', quantity: 2 };
    await customer
      .put('/api/v1/cart')
      .send({ items: [line] })
      .expect(200);
    const created = await customer.post('/api/v1/checkout/orders').send(checkout()).expect(201);
    await customer
      .put('/api/v1/cart')
      .send({ items: [{ ...line, quantity: 3 }] })
      .expect(200);
    await customer
      .post('/api/v1/payments/mock')
      .send({ orderId: created.body.data.order.id, outcome: 'success' })
      .expect(200);
    await customer
      .get('/api/v1/cart')
      .expect((res) => expect(res.body.data.items[0].quantity).toBe(2));
    await admin
      .post('/api/v1/admin/inventory/adjustments')
      .send({ productId, variantId: 'oat-m', delta: -4, reason: 'Damaged remaining stock' })
      .expect(201);
    await customer.get('/api/v1/cart').expect((res) => {
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].product.variants[0].stock).toBe(0);
    });
    await customer
      .post('/api/v1/checkout/preview')
      .send({ items: [line], shippingMethod: 'standard' })
      .expect(409);
  });
  it('releases failed payment inventory and coupon usage atomically and cannot resurrect a cancelled order', async () => {
    await CouponModel.create({
      code: 'LIMITED',
      type: 'fixed',
      value: 1000,
      minimum: 0,
      usageLimit: 1,
      active: true,
      used: 0,
    });
    const created = await request(app)
      .post('/api/v1/checkout/orders')
      .send(checkout({ couponCode: 'LIMITED' }))
      .expect(201);
    expect((await CouponModel.findOne({ code: 'LIMITED' }))!.used).toBe(1);
    const payment = {
      orderId: created.body.data.order.id,
      guestToken: created.body.data.guestToken,
    };
    await request(app)
      .post('/api/v1/payments/mock')
      .send({ ...payment, outcome: 'failure' })
      .expect(200)
      .expect((res) => expect(res.body.data.order.paymentStatus).toBe('failed'));
    expect(await stock()).toBe(5);
    expect((await CouponModel.findOne({ code: 'LIMITED' }))!.used).toBe(0);
    await request(app)
      .post('/api/v1/payments/mock')
      .send({ ...payment, outcome: 'success' })
      .expect(409);
    expect(await stock()).toBe(5);
    expect(await ReservationModel.countDocuments({ status: 'released' })).toBe(1);
  });
  it('expires reservations once and refuses late mock settlement', async () => {
    const created = await request(app).post('/api/v1/checkout/orders').send(checkout()).expect(201);
    await OrderModel.updateOne(
      { _id: created.body.data.order.id },
      { $set: { expiresAt: new Date(Date.now() - 1) } },
    );
    await Promise.all([expireReservations(), expireReservations()]);
    await expireReservations();
    expect(await stock()).toBe(5);
    const order = await OrderModel.findById(created.body.data.order.id);
    expect(order?.status).toBe('expired');
    await request(app)
      .post('/api/v1/payments/mock')
      .send({
        orderId: String(order!._id),
        guestToken: created.body.data.guestToken,
        outcome: 'success',
      })
      .expect(409);
  });
  it('rolls back coupon holds and earlier item reservations when any item is unavailable', async () => {
    await CouponModel.create({
      code: 'LIMITED',
      type: 'fixed',
      value: 1000,
      minimum: 0,
      usageLimit: 1,
      active: true,
      used: 0,
    });
    await request(app)
      .post('/api/v1/checkout/orders')
      .send(
        checkout({
          couponCode: 'LIMITED',
          items: [
            { productId, variantId: 'oat-m', quantity: 1 },
            { productId, variantId: 'black-s', quantity: 1 },
          ],
        }),
      )
      .expect(409);
    expect(await stock()).toBe(5);
    expect(await OrderModel.countDocuments()).toBe(0);
    expect((await CouponModel.findOne({ code: 'LIMITED' }))!.used).toBe(0);
  });
  it('verifies Stripe webhook signatures, exact amount, session identity and duplicate event delivery', async () => {
    const created = await request(app)
      .post('/api/v1/checkout/orders')
      .send(checkout({ paymentMethod: 'stripe' }))
      .expect(201);
    const id = created.body.data.order.id;
    await OrderModel.updateOne({ _id: id }, { $set: { stripeSessionId: 'cs_test_fixture' } });
    const sendEvent = async (amount: number, eventId: string) => {
      const payload = JSON.stringify({
        id: eventId,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_fixture',
            metadata: { orderId: id },
            payment_status: 'paid',
            amount_total: amount,
            currency: 'usd',
            payment_intent: 'pi_test_fixture',
          },
        },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_velora_fixture',
      });
      return request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload);
    };
    await request(app).post('/api/v1/payments/stripe/webhook').send({}).expect(400);
    expect((await sendEvent(1, 'evt_wrong')).status).toBe(409);
    expect((await sendEvent(created.body.data.order.totals.total, 'evt_paid')).status).toBe(200);
    expect((await sendEvent(created.body.data.order.totals.total, 'evt_paid')).status).toBe(200);
    expect(await PaymentEventModel.countDocuments()).toBe(1);
    expect(await PaymentModel.countDocuments()).toBe(1);
    expect(await stock()).toBe(4);
  });
});

describe('administrative integrity and persisted analytics', () => {
  it('searches inventory by both product and variant SKU', async () => {
    for (const q of [productInput.sku, productInput.variants[0].sku]) {
      const inventory = await admin.get('/api/v1/admin/inventory').query({ q }).expect(200);
      expect(
        inventory.body.data.items.some(
          (item: { sku: string }) => item.sku === productInput.variants[0].sku,
        ),
      ).toBe(true);
    }
    const missing = await admin.get('/api/v1/admin/inventory?q=NO-SUCH-SKU').expect(200);
    expect(missing.body.data.items).toEqual([]);
  });
  it('reports customer order counts and paid spending consistently in lists and details', async () => {
    const paid = await customer.post('/api/v1/checkout/orders').send(checkout()).expect(201);
    await customer
      .post('/api/v1/payments/mock')
      .send({ orderId: paid.body.data.order.id })
      .expect(200);
    await customer.post('/api/v1/checkout/orders').send(checkout()).expect(201);
    const result = await admin
      .get('/api/v1/admin/customers?limit=1&q=customer@example.test')
      .expect(200);
    expect(result.body.data).toMatchObject({ total: 1, page: 1, pages: 1 });
    const summary = result.body.data.items[0];
    expect(summary).toMatchObject({
      email: 'customer@example.test',
      orderCount: 2,
      totalSpent: paid.body.data.order.totals.total,
    });
    const detail = await admin.get(`/api/v1/admin/customers/${summary.id}`).expect(200);
    expect(detail.body.data.customer).toEqual(summary);
    const empty = await admin.get('/api/v1/admin/customers?q=other@example.test').expect(200);
    expect(empty.body.data.items[0]).toMatchObject({ orderCount: 0, totalSpent: 0 });
    const noMatch = await admin.get('/api/v1/admin/customers?q=missing@example.test').expect(200);
    expect(noMatch.body.data.items).toEqual([]);
  });
  it('prevents product edits from removing a variant held by an active checkout', async () => {
    await customer.post('/api/v1/checkout/orders').send(checkout()).expect(201);
    const movements = await MovementModel.countDocuments({ productId });
    await admin
      .patch(`/api/v1/admin/products/${productId}`)
      .send({ variants: [productInput.variants[1]] })
      .expect(409)
      .expect((res) => expect(res.body.error.code).toBe('VARIANT_RESERVED'));
    expect((await ProductModel.findById(productId))!.variants).toHaveLength(2);
    expect(await stock()).toBe(4);
    expect(await MovementModel.countDocuments({ productId })).toBe(movements);
  });
  it('creates, edits and archives products while auditing stock and restricting stock edits', async () => {
    const created = await admin
      .post('/api/v1/admin/products')
      .send({ ...productInput, name: 'Second Knit', slug: 'second-knit', sku: 'SECOND' })
      .expect(201);
    const id = created.body.data.id;
    await admin.patch(`/api/v1/admin/products/${id}`).send({ name: 'Edited Knit' }).expect(200);
    await admin
      .patch(`/api/v1/admin/products/${id}`)
      .send({ variants: [{ ...productInput.variants[0], stock: 999 }] })
      .expect(409);
    await admin
      .post('/api/v1/admin/inventory/adjustments')
      .send({ productId: id, variantId: 'oat-m', delta: -6, reason: 'Invalid recount' })
      .expect(409);
    await admin
      .post('/api/v1/admin/inventory/adjustments')
      .send({ productId: id, variantId: 'oat-m', delta: 3, reason: 'Warehouse recount' })
      .expect(201);
    expect(await MovementModel.countDocuments({ productId: id })).toBe(2);
    await admin.delete(`/api/v1/admin/products/${id}`).expect(200);
    await request(app).get('/api/v1/products/second-knit').expect(404);
  });
  it('validates fulfillment transitions, requires tracking and derives dashboard totals from actual payments', async () => {
    const created = await customer.post('/api/v1/checkout/orders').send(checkout()).expect(201);
    const id = created.body.data.order.id;
    await admin.patch(`/api/v1/admin/orders/${id}`).send({ status: 'paid' }).expect(409);
    await customer
      .post('/api/v1/payments/mock')
      .send({ orderId: id, outcome: 'success' })
      .expect(200);
    await admin.patch(`/api/v1/admin/orders/${id}`).send({ status: 'processing' }).expect(200);
    await admin.patch(`/api/v1/admin/orders/${id}`).send({ status: 'shipped' }).expect(422);
    await admin
      .patch(`/api/v1/admin/orders/${id}`)
      .send({ status: 'shipped', trackingNumber: 'TEST-TRACKING' })
      .expect(200);
    const dashboard = await admin.get('/api/v1/admin/dashboard').expect(200);
    expect(dashboard.body.data).toMatchObject({
      revenue: created.body.data.order.totals.total,
      orderCount: 1,
      productCount: 1,
      customerCount: 2,
    });
    expect(dashboard.body.data.revenueTrend).toHaveLength(90);
    expect(dashboard.body.data.bestSellers[0]).toMatchObject({
      name: productInput.name,
      quantity: 1,
    });
    const customers = await admin.get('/api/v1/admin/customers?q=customer').expect(200);
    expect(customers.body.data.items[0].totalSpent).toBe(created.body.data.order.totals.total);
  });
  it('releases stock on authorized pending cancellation and prevents deleting taxonomy in use', async () => {
    const created = await request(app).post('/api/v1/checkout/orders').send(checkout()).expect(201);
    await admin
      .patch(`/api/v1/admin/orders/${created.body.data.order.id}`)
      .send({ status: 'cancelled' })
      .expect(200);
    expect(await stock()).toBe(5);
    const category = await CategoryModel.findOne({ slug: 'knitwear' });
    await admin.delete(`/api/v1/admin/categories/${category!._id}`).expect(409);
  });
});
