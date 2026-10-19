import { describe, expect, it } from 'vitest';
import { checkoutSchema, couponSchema, productSchema } from '@velora/contracts';
import { calculateTotals, assertOrderTransition } from '../src/modules/commerce.js';

describe('authoritative integer-cent pricing', () => {
  it('calculates discounts before tax and free-shipping eligibility', () => {
    expect(
      calculateTotals(16000, 'standard', { type: 'percentage', value: 10, code: 'WELCOME10' }),
    ).toEqual({
      subtotal: 16000,
      discount: 1600,
      shipping: 800,
      tax: 1152,
      total: 16352,
      currency: 'USD',
      couponCode: 'WELCOME10',
    });
    expect(calculateTotals(15000, 'standard').shipping).toBe(0);
    expect(calculateTotals(15000, 'express').shipping).toBe(1800);
  });
  it('caps fixed discounts at subtotal and rounds fractional cents once', () => {
    expect(
      calculateTotals(101, 'standard', { type: 'percentage', value: 15, code: 'FIFTEEN' }),
    ).toMatchObject({ discount: 15, tax: 7, total: 893 });
    expect(
      calculateTotals(1000, 'standard', { type: 'fixed', value: 5000, code: 'GIFT' }),
    ).toMatchObject({ discount: 1000, tax: 0, total: 800 });
    expect(() => calculateTotals(10.5, 'standard')).toThrow('Invalid order subtotal');
  });
});
describe('fulfillment rules and shared validation', () => {
  it('permits forward fulfillment and prevents paid orders being forged by admin status updates', () => {
    expect(() => assertOrderTransition('paid', 'processing')).not.toThrow();
    expect(() => assertOrderTransition('shipped', 'delivered')).not.toThrow();
    expect(() => assertOrderTransition('pending', 'paid')).toThrow();
    expect(() => assertOrderTransition('delivered', 'processing')).toThrow();
  });
  it('rejects invalid percentage coupons, unbounded quantities, and duplicate variant ids', () => {
    expect(couponSchema.safeParse({ code: 'SALE', type: 'percentage', value: 101 }).success).toBe(
      false,
    );
    expect(
      checkoutSchema.safeParse({ items: [{ productId: 'p', variantId: 'v', quantity: 21 }] })
        .success,
    ).toBe(false);
    const variant = {
      id: 'v',
      sku: 'SKU-V',
      size: 'M',
      color: 'Black',
      colorHex: '#000000',
      stock: 4,
    };
    expect(
      productSchema.safeParse({
        name: 'Test Knit',
        slug: 'test-knit',
        sku: 'SKU',
        description: 'A beautifully made everyday essential.',
        category: 'knitwear',
        collection: 'autumn-edit',
        gender: 'women',
        images: ['/images/knit.jpg'],
        price: 10000,
        variants: [variant, variant],
      }).success,
    ).toBe(false);
  });
});
