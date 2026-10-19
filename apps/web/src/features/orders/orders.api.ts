import type { Order, Page } from '@velora/contracts';
import { checkoutApi } from '@/features/checkout/api/checkout.api';
// Extend the same API so existing ordersApi checkout/payment hooks remain compatible.
export const ordersApi = checkoutApi.injectEndpoints({
  endpoints: (builder) => ({
    orders: builder.query<Page<Order>, number | void>({
      query: (page) => `/orders?page=${page || 1}`,
      providesTags: ['Orders'],
    }),
    order: builder.query<Order, { id: string; token?: string }>({
      query: ({ id, token }) =>
        `/orders/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`,
      providesTags: ['Orders'],
    }),
  }),
});
export const {
  usePreviewMutation,
  useCheckoutMutation,
  usePayMockMutation,
  useStripeSessionMutation,
  useOrdersQuery,
  useOrderQuery,
} = ordersApi;
