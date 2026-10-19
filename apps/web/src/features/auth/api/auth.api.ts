import type { User, LoginInput, RegisterInput, Address } from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';
export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    me: builder.query<User | null, void>({ query: () => '/auth/me', providesTags: ['Auth'] }),
    login: builder.mutation<User, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth', 'Cart', 'Wishlist', 'Orders', 'Admin'],
    }),
    register: builder.mutation<User, RegisterInput>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      invalidatesTags: ['Auth', 'Cart', 'Wishlist', 'Orders'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth', 'Cart', 'Wishlist', 'Orders', 'Admin'],
    }),
    updateProfile: builder.mutation<User, { name: string; addresses?: Address[] }>({
      query: (body) => ({ url: '/users/profile', method: 'PATCH', body }),
      invalidatesTags: ['Auth'],
    }),
    changePassword: builder.mutation<void, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/users/password', method: 'POST', body }),
    }),
  }),
});
export const {
  useMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} = authApi;
