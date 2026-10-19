import { Router } from 'express';
import { cartItemsSchema, cartLineSchema } from '@velora/contracts';
import { CartModel } from '../../models.js';
import { data, parameter, parse } from '../../http.js';
import { requireAuth, currentUser } from '../auth.js';
import { hydrateCart, saveCart } from './cart.service.js';

export const cartRoutes = Router();
cartRoutes.use(requireAuth);
cartRoutes.get('/', async (req, res) =>
  data(
    res,
    await hydrateCart((await CartModel.findOne({ userId: currentUser(req).id }))?.items ?? []),
  ),
);
cartRoutes.put('/', async (req, res) => {
  const { items } = parse(cartItemsSchema, req.body);
  const cart = await saveCart(currentUser(req).id, items, 'validate');
  data(res, cart);
});
cartRoutes.post('/merge', async (req, res) => {
  const { items } = parse(cartItemsSchema, req.body);
  const existing = (await CartModel.findOne({ userId: currentUser(req).id }))?.items ?? [];
  const cart = await saveCart(currentUser(req).id, [...existing, ...items], 'merge');
  data(res, cart);
});
cartRoutes.post('/items', async (req, res) => {
  const line = parse(cartLineSchema, req.body);
  const existing = (await CartModel.findOne({ userId: currentUser(req).id }))?.items ?? [];
  const cart = await saveCart(currentUser(req).id, [...existing, line], 'validate');
  data(res, cart, 201);
});
cartRoutes.delete('/items/:variantId', async (req, res) => {
  await CartModel.updateOne(
    { userId: currentUser(req).id },
    { $pull: { items: { variantId: parameter(req, 'variantId') } } },
  );
  data(
    res,
    await hydrateCart((await CartModel.findOne({ userId: currentUser(req).id }))?.items ?? []),
  );
});
