import mongoose from 'mongoose';
import { productSchema, type ProductInput, type InventoryAdjustment } from '@velora/contracts';
import { AppError, parse, objectId } from '../../http.js';
import {
  CategoryModel,
  CollectionModel,
  MovementModel,
  ProductModel,
  ReservationModel,
} from '../../models.js';
import { productDto, movementDto } from '../../serializers.js';

async function validateTaxonomy(category: string, collection: string): Promise<void> {
  const [categoryExists, collectionExists] = await Promise.all([
    CategoryModel.exists({ slug: category }),
    CollectionModel.exists({ slug: collection }),
  ]);
  if (!categoryExists || !collectionExists)
    throw new AppError(422, 'INVALID_TAXONOMY', 'Choose an existing category and collection');
}
export async function createProduct(input: ProductInput, actorId: string) {
  await validateTaxonomy(input.category, input.collection);
  const session = await mongoose.startSession();
  let createdId = '';
  try {
    await session.withTransaction(async () => {
      const [product] = await ProductModel.create(
        [{ ...input, currency: 'USD', rating: 0, reviewCount: 0 }],
        { session },
      );
      createdId = String(product._id);
      for (const variant of input.variants)
        if (variant.stock)
          await MovementModel.create(
            [
              {
                productId: createdId,
                variantId: variant.id,
                delta: variant.stock,
                reason: 'Initial product inventory',
                actorId,
              },
            ],
            { session },
          );
    });
  } finally {
    await session.endSession();
  }
  const product = await ProductModel.findById(createdId);
  if (!product) throw new AppError(500, 'PRODUCT_CREATE_FAILED', 'Could not create the product');
  return productDto(product);
}

export async function updateProduct(id: string, patch: unknown, actorId: string) {
  if (typeof patch !== 'object' || !patch || Array.isArray(patch))
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide product fields');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const existing = await ProductModel.findById(id).session(session);
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Product not found');
      const input = parse(productSchema, { ...productDto(existing), ...patch });
      await validateTaxonomy(input.category, input.collection);
      const removed = existing.variants.filter(
        (v) => !input.variants.some((next) => next.id === v.id),
      );
      if (
        removed.length &&
        (await ReservationModel.exists({
          productId: id,
          variantId: { $in: removed.map((v) => v.id) },
          status: 'held',
        }).session(session))
      )
        throw new AppError(
          409,
          'VARIANT_RESERVED',
          'A reserved variant cannot be removed until its checkout finishes or expires',
        );
      for (const variant of input.variants) {
        const previous = existing.variants.find((v) => v.id === variant.id);
        const previousStock = previous?.stock ?? 0;
        if (previous && previousStock !== variant.stock)
          throw new AppError(
            409,
            'USE_INVENTORY_ADJUSTMENT',
            'Use an inventory adjustment to change existing stock. Reload the product if its stock changed during editing.',
          );
        if (variant.stock !== previousStock)
          await MovementModel.create(
            [
              {
                productId: id,
                variantId: variant.id,
                delta: variant.stock - previousStock,
                reason: 'Product editor stock update',
                actorId,
              },
            ],
            { session },
          );
      }
      for (const removedVariant of removed)
        if (removedVariant.stock)
          await MovementModel.create(
            [
              {
                productId: id,
                variantId: removedVariant.id,
                delta: -removedVariant.stock,
                reason: 'Variant removed',
                actorId,
              },
            ],
            { session },
          );
      existing.set(input);
      await existing.save({ session });
    });
  } finally {
    await session.endSession();
  }
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  return productDto(product);
}

export async function adjustInventory(input: InventoryAdjustment, actorId: string) {
  objectId(input.productId);
  const session = await mongoose.startSession();
  let movementId = '';
  try {
    await session.withTransaction(async () => {
      const changed = await ProductModel.updateOne(
        {
          _id: input.productId,
          variants: {
            $elemMatch: {
              id: input.variantId,
              ...(input.delta < 0
                ? { stock: { $gte: -input.delta } }
                : { stock: { $lte: 100000 - input.delta } }),
            },
          },
        },
        { $inc: { 'variants.$.stock': input.delta } },
        { session },
      );
      if (!changed.modifiedCount)
        throw new AppError(
          409,
          'INVALID_STOCK_ADJUSTMENT',
          'Variant not found or adjustment would exceed stock limits',
        );
      const [movement] = await MovementModel.create([{ ...input, actorId }], {
        session,
      });
      movementId = String(movement._id);
    });
  } finally {
    await session.endSession();
  }
  const movement = await MovementModel.findById(movementId);
  if (!movement) throw new AppError(500, 'INVENTORY_FAILED', 'Could not record the adjustment');
  return movementDto(movement);
}
