import type { Product } from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';
export const wishlistApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    wishlist: builder.query<Product[], void>({
      query: () => '/wishlist',
      providesTags: ['Wishlist'],
    }),
    addWishlist: builder.mutation<void, string>({
      query: (id) => ({ url: `/wishlist/${id}`, method: 'POST' }),
      invalidatesTags: ['Wishlist'],
    }),
    removeWishlist: builder.mutation<void, string>({
      query: (id) => ({ url: `/wishlist/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Wishlist'],
    }),
  }),
});
export const { useWishlistQuery, useAddWishlistMutation, useRemoveWishlistMutation } = wishlistApi;
