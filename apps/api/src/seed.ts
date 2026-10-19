import { pathToFileURL } from 'node:url';
import argon2 from 'argon2';
import mongoose, { Types } from 'mongoose';
import type { Address, OrderStatus, ProductInput } from '@velora/contracts';
import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import {
  CartModel,
  CategoryModel,
  CollectionModel,
  CouponModel,
  initializeIndexes,
  MovementModel,
  OrderModel,
  PaymentModel,
  ProductModel,
  ReservationModel,
  ReviewModel,
  UserModel,
  WishlistModel,
} from './models.js';
import { calculateTotals } from './modules/commerce.js';

const fixedId = (group: number, index: number): Types.ObjectId =>
  new Types.ObjectId(
    `${group.toString(16).padStart(4, '0')}${index.toString(16).padStart(20, '0')}`,
  );
const address: Address = {
  name: 'Alex Morgan',
  line1: '120 Example Avenue',
  line2: 'Apt 4',
  city: 'Portland',
  region: 'Oregon',
  postalCode: '97201',
  country: 'US',
};
const families = [
  {
    category: 'knitwear',
    image: 'knit',
    names: [
      'The Cashmere Crew',
      'Relaxed Wool Cardigan',
      'Ribbed Merino Turtleneck',
      'Soft Cashmere V-Neck',
      'Textured Cotton Knit',
      'Weekend Cable Sweater',
    ],
    price: 16800,
    gender: 'women',
  },
  {
    category: 'outerwear',
    image: 'coat',
    names: [
      'The Essential Trench',
      'Wool Wrap Coat',
      'City Twill Jacket',
      'Double-Breasted Blazer',
      'Quilted Weekend Jacket',
      'The Longline Coat',
    ],
    price: 24800,
    gender: 'women',
  },
  {
    category: 'shirts',
    image: 'shirt',
    names: [
      'The Linen Shirt',
      'Oxford Cotton Shirt',
      'Relaxed Poplin Shirt',
      'Silk Blend Blouse',
      'The Everyday Overshirt',
      'Brushed Cotton Shirt',
    ],
    price: 9800,
    gender: 'men',
  },
  {
    category: 'trousers',
    image: 'trousers',
    names: [
      'Tailored Wide-Leg Trouser',
      'The Straight-Leg Chino',
      'Fluid Pleated Pant',
      'Everyday Linen Trouser',
      'Modern Tapered Trouser',
      'Relaxed Wool Trouser',
    ],
    price: 12800,
    gender: 'women',
  },
  {
    category: 'dresses',
    image: 'dress',
    names: [
      'The Satin Slip Dress',
      'Linen Midi Dress',
      'Ribbed Knit Dress',
      'The Wrap Dress',
      'Cotton Shirt Dress',
      'Evening Column Dress',
    ],
    price: 15800,
    gender: 'women',
  },
  {
    category: 'accessories',
    image: 'bag',
    names: [
      'The Everyday Leather Tote',
      'The Mini Shoulder Bag',
      'Soft Suede Shopper',
      'The Weekender Bag',
      'Structured Leather Satchel',
      'The City Crossbody',
    ],
    price: 13800,
    gender: 'unisex',
  },
  {
    category: 'footwear',
    image: 'sneaker',
    names: [
      'The Everyday Sneaker',
      'Minimal Leather Trainer',
      'The Court Sneaker',
      'Canvas Weekend Sneaker',
      'Suede Low-Top Trainer',
      'The Classic Runner',
    ],
    price: 11800,
    gender: 'unisex',
  },
] as const;

export async function seedDatabase({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (config.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  if (!force && (await ProductModel.estimatedDocumentCount())) return;
  if (force) await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
  await initializeIndexes();
  const passwordHash = await argon2.hash('VeloraDemo2026!', { type: argon2.argon2id });
  const names = ['Alex Morgan', 'Jordan Avery', 'Taylor Quinn', 'Casey Rowan'];
  const users = await UserModel.create([
    {
      _id: fixedId(1, 1),
      name: 'VELORA Administrator',
      email: 'admin@velora.local',
      passwordHash,
      role: 'admin',
      addresses: [],
    },
    ...names.map((name, index) => ({
      _id: fixedId(1, index + 2),
      name,
      email:
        index === 0
          ? 'customer@velora.local'
          : `${name.toLowerCase().replace(' ', '.')}@example.test`,
      passwordHash,
      role: 'customer',
      addresses: [{ ...address, name }],
    })),
  ]);
  await CategoryModel.create(
    families.map((family, index) => ({
      _id: fixedId(2, index + 1),
      name: {
        knitwear: 'Knitwear',
        outerwear: 'Outerwear',
        shirts: 'Shirts',
        trousers: 'Trousers',
        dresses: 'Dresses',
        accessories: 'Accessories',
        footwear: 'Footwear',
      }[family.category],
      slug: family.category,
      image: `/images/${family.image}.jpg`,
      description: `Considered ${family.category} for a wardrobe that lasts. Beautiful fabrics, effortless proportions.`,
    })),
  );
  await CollectionModel.create([
    {
      _id: fixedId(3, 1),
      name: 'The Autumn Edit',
      slug: 'autumn-edit',
      image: '/images/coat.jpg',
      description: 'A softer season. Warm textures and considered layers for cooler days.',
    },
    {
      _id: fixedId(3, 2),
      name: 'Everyday Essentials',
      slug: 'everyday-essentials',
      image: '/images/shirt.jpg',
      description:
        'The pieces you reach for, day after day. Quietly refined and effortlessly versatile.',
    },
    {
      _id: fixedId(3, 3),
      name: 'Modern Classics',
      slug: 'modern-classics',
      image: '/images/knit.jpg',
      description: 'Timeless silhouettes, thoughtfully reimagined for the way you live now.',
    },
  ]);
  const productInputs = families.flatMap((family, familyIndex) =>
    family.names.map((name, nameIndex) => {
      const index = familyIndex * 6 + nameIndex;
      const sizes =
        family.category === 'accessories'
          ? ['One size']
          : family.category === 'footwear'
            ? ['37', '38', '39', '40', '41', '42']
            : ['XS', 'S', 'M', 'L', 'XL'];
      const colors = [
        { name: 'Oatmeal', hex: '#C4B8A5' },
        { name: 'Espresso', hex: '#4A3930' },
      ];
      const input: ProductInput = {
        name,
        slug: name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-$/, ''),
        sku: `VL-${(index + 1).toString().padStart(4, '0')}`,
        description: `Meet ${name.toLowerCase()}, a considered addition to your everyday wardrobe. Made with a beautiful, soft-touch fabric and a relaxed, flattering silhouette, this piece brings quiet refinement to every occasion. Thoughtful finishing and enduring quality make it a favorite for seasons to come. Designed for easy layering and all-day comfort.\n\nCare: gentle cold wash or professional dry clean as appropriate. Follow the garment care label. Our editorial photographs illustrate the collection; color and texture may vary between styles.`,
        category: family.category,
        collection: ['autumn-edit', 'everyday-essentials', 'modern-classics'][nameIndex % 3],
        gender: family.gender,
        images: [`/images/${family.image}.jpg`],
        price: family.price + nameIndex * 1000,
        compareAtPrice: nameIndex % 3 === 0 ? family.price + 6000 : null,
        status: 'published',
        tags: [
          'new-season',
          ...(nameIndex < 2 ? ['bestseller'] : []),
          ...(family.category === 'knitwear' ? ['soft-touch', 'natural-fibers'] : []),
        ],
        variants: colors.flatMap((color, colorIndex) =>
          sizes.map((size, sizeIndex) => ({
            id: `v-${index + 1}-${colorIndex}-${sizeIndex}`,
            sku: `VL-${index + 1}-${colorIndex}-${sizeIndex}`,
            size,
            color: color.name,
            colorHex: color.hex,
            stock:
              colorIndex === 1 && sizeIndex === 0
                ? index % 3
                : sizeIndex === 0
                  ? 5
                  : 18 + ((index + sizeIndex) % 12),
          })),
        ),
      };
      return {
        ...input,
        _id: fixedId(4, index + 1),
        currency: 'USD' as const,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date(Date.now() - (nameIndex * 7 + familyIndex) * 86400000),
      };
    }),
  );
  const products = await ProductModel.create(productInputs);
  const initialMovements = products.flatMap((p) =>
    p.variants
      .filter((v) => v.stock > 0)
      .map((v) => ({
        productId: String(p._id),
        variantId: v.id,
        delta: v.stock,
        reason: 'Opening demo inventory',
        actorId: String(users[0]._id),
      })),
  );
  await MovementModel.insertMany(initialMovements);
  await CouponModel.create([
    {
      _id: fixedId(5, 1),
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minimum: 5000,
      usageLimit: 1000,
      active: true,
      expiresAt: null,
      used: 0,
    },
    {
      _id: fixedId(5, 2),
      code: 'AUTUMN20',
      type: 'fixed',
      value: 2000,
      minimum: 15000,
      usageLimit: 100,
      active: true,
      expiresAt: null,
      used: 0,
    },
  ]);
  for (let index = 0; index < 45; index++) {
    const product = products[index % products.length];
    const variant = product.variants.find((v) => v.stock >= 5)!;
    const user = users[1 + (index % 4)];
    const createdAt = new Date(Date.now() - ((44 - index) * 24 + (index % 8)) * 60 * 60 * 1000);
    const statuses: OrderStatus[] = ['delivered', 'delivered', 'shipped', 'processing', 'paid'];
    const status = index < 35 ? 'delivered' : statuses[index % statuses.length];
    const totals = calculateTotals(product.price, 'standard');
    const orderId = fixedId(6, index + 1);
    const item = {
      productId: String(product._id),
      variantId: variant.id,
      name: product.name,
      image: product.images[0],
      size: variant.size,
      color: variant.color,
      quantity: 1,
      unitPrice: product.price,
    };
    await OrderModel.create({
      _id: orderId,
      number: `VL-DEMO-${(index + 1).toString().padStart(4, '0')}`,
      userId: user._id,
      email: user.email,
      address: { ...address, name: user.name },
      items: [item],
      totals,
      status,
      paymentStatus: 'paid',
      paymentMethod: 'mock',
      shippingMethod: 'standard',
      trackingNumber: ['shipped', 'delivered'].includes(status)
        ? `DEMO${String(index + 1).padStart(10, '0')}`
        : undefined,
      idempotencyKey: `seed-${index}`,
      requestHash: `seed-${index}`,
      reservationReleased: false,
      createdAt,
      updatedAt: createdAt,
    });
    await PaymentModel.create({
      orderId,
      provider: 'mock',
      providerId: `mock:seed:${index}`,
      amount: totals.total,
      currency: 'USD',
      status: 'paid',
      createdAt,
      updatedAt: createdAt,
    });
    await ReservationModel.create({
      orderId,
      productId: String(product._id),
      variantId: variant.id,
      quantity: 1,
      status: 'consumed',
      expiresAt: createdAt,
    });
    await ProductModel.updateOne(
      { _id: product._id, 'variants.id': variant.id },
      { $inc: { 'variants.$.stock': -1 } },
    );
    await MovementModel.create({
      productId: String(product._id),
      variantId: variant.id,
      delta: -1,
      reason: 'Demo order fulfilled',
      orderId: String(orderId),
      actorId: String(user._id),
      createdAt,
      updatedAt: createdAt,
    });
  }
  const titles = [
    'A new wardrobe favorite',
    'Beautiful quality and fit',
    'Exactly what I was looking for',
  ];
  const bodies = [
    'The fabric feels beautiful and the fit is effortless. A considered piece that works just as well for work as it does for the weekend.',
    'Lovely quality, thoughtful details, and the kind of simple design I will wear for years. Delivery was smooth and everything arrived beautifully.',
    'The finish and comfort exceeded my expectations. I followed the size guide and found the fit true to size. I would happily order again.',
  ];
  for (const [productIndex, product] of products.entries()) {
    const ratings = [5, 4, productIndex % 3 === 0 ? 4 : 5];
    await ReviewModel.create(
      ratings.map((rating, index) => ({
        productId: product._id,
        userId: users[index + 1]._id,
        name: users[index + 1].name,
        rating,
        title: titles[index],
        body: bodies[index],
        verified: productIndex % 4 === index,
        createdAt: new Date(Date.now() - (index + 2) * 86400000),
      })),
    );
    await ProductModel.updateOne(
      { _id: product._id },
      {
        $set: {
          rating: Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10,
          reviewCount: ratings.length,
        },
      },
    );
  }
  await CartModel.create({ userId: users[1]._id, items: [] });
  await WishlistModel.create({
    userId: users[1]._id,
    productIds: [String(products[0]._id), String(products[7]._id)],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDatabase();
  try {
    await seedDatabase({ force: process.argv.includes('--force') });
    console.info('VELORA demo seed is ready.');
  } finally {
    await disconnectDatabase();
  }
}
