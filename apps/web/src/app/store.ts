import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '@/lib/api/baseApi';
import guestCart from '@/features/cart/cart.slice';
export const store = configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer, guestCart },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});
let previousCart = store.getState().guestCart;
store.subscribe(() => {
  const cart = store.getState().guestCart;
  if (cart !== previousCart) {
    previousCart = cart;
    try {
      localStorage.setItem('velora-cart', JSON.stringify(cart.items));
      localStorage.setItem('velora-settled-orders', JSON.stringify(cart.settledOrderIds));
    } catch {
      /* Storage may be disabled by the browser. */
    }
  }
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
