import { Router } from 'express';
import { WishlistModel, ProductModel } from '../../models.js';
import { AppError, data, objectId, parameter } from '../../http.js';
import { productDto } from '../../serializers.js';
import { requireAuth, currentUser } from '../auth.js';

export const wishlistRoutes = Router();
wishlistRoutes.use(requireAuth);
wishlistRoutes.get('/', async (req, res) => {
  const wishlist = await WishlistModel.findOne({ userId: currentUser(req).id });
  data(
    res,
    (
      await ProductModel.find({
        _id: { $in: wishlist?.productIds ?? [] },
        status: 'published',
      }).lean()
    ).map(productDto),
  );
});
wishlistRoutes.post('/:productId', async (req, res) => {
  const id = objectId(parameter(req, 'productId'));
  if (!(await ProductModel.exists({ _id: id, status: 'published' })))
    throw new AppError(404, 'NOT_FOUND', 'Product not found');
  await WishlistModel.updateOne(
    { userId: currentUser(req).id },
    { $addToSet: { productIds: id } },
    { upsert: true },
  );
  data(res, { message: 'Added to your wishlist' });
});
wishlistRoutes.delete('/:productId', async (req, res) => {
  await WishlistModel.updateOne(
    { userId: currentUser(req).id },
    { $pull: { productIds: objectId(parameter(req, 'productId')) } },
  );
  data(res, { message: 'Removed from your wishlist' });
});
