import type {
  CheckoutInput,
  CheckoutResult,
  PaymentResult,
  PreviewInput,
  Totals,
  CheckoutOptions,
} from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';

export const checkoutApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    checkoutOptions: builder.query<CheckoutOptions, void>({
      query: () => '/checkout/options',
    }),
    preview: builder.mutation<Totals, PreviewInput>({
      query: (body) => ({ url: '/checkout/preview', method: 'POST', body }),
    }),
    checkout: builder.mutation<CheckoutResult, CheckoutInput>({
      query: (body) => ({ url: '/checkout/orders', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Admin', 'Catalog'],
    }),
    payMock: builder.mutation<
      PaymentResult,
      { orderId: string; outcome: 'success' | 'failure'; guestToken?: string }
    >({
      query: (body) => ({ url: '/payments/mock', method: 'POST', body }),
      invalidatesTags: ['Orders', 'Cart', 'Admin', 'Catalog'],
    }),
    stripeSession: builder.mutation<PaymentResult, { orderId: string; guestToken?: string }>({
      query: (body) => ({ url: '/payments/stripe/session', method: 'POST', body }),
    }),
  }),
});

export const {
  useCheckoutOptionsQuery,
  usePreviewMutation,
  useCheckoutMutation,
  usePayMockMutation,
  useStripeSessionMutation,
} = checkoutApi;
