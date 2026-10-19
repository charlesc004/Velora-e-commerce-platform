import type { Cart, CartLine } from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';
export const cartApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    cart: builder.query<Cart, void>({ query: () => '/cart', providesTags: ['Cart'] }),
    setCart: builder.mutation<Cart, { items: CartLine[] }>({
      query: (body) => ({ url: '/cart', method: 'PUT', body }),
      invalidatesTags: ['Cart'],
    }),
    mergeCart: builder.mutation<Cart, { items: CartLine[] }>({
      query: (body) => ({ url: '/cart/merge', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
  }),
});
export const { useCartQuery, useSetCartMutation, useMergeCartMutation } = cartApi;
