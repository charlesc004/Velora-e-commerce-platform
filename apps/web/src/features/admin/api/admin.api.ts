import type {
  Category,
  Coupon,
  CouponInput,
  Customer,
  Dashboard,
  InventoryAdjustment,
  InventoryMovement,
  Order,
  OrderStatus,
  Page,
  Product,
  ProductInput,
} from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';

export type ListQuery = { page?: number; q?: string; status?: string; limit?: number };
export type TaxonomyInput = Omit<Category, 'id'>;
export interface InventoryRecord {
  productId: string;
  name: string;
  variantId: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
}
export interface StoreSettings {
  storeName: string;
  currency: string;
  shipping: { standard: number; express: number; freeThreshold: number };
  taxRate: number;
  paymentMethods: string[];
}
export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    dashboard: build.query<Dashboard, void>({
      query: () => '/admin/dashboard',
      providesTags: ['Admin'],
    }),
    adminProducts: build.query<Page<Product>, ListQuery>({
      query: (params) => ({ url: '/admin/products', params }),
      providesTags: ['Admin'],
    }),
    saveProduct: build.mutation<Product, { id?: string; data: Partial<ProductInput> }>({
      query: ({ id, data }) => ({
        url: `/admin/products${id ? `/${id}` : ''}`,
        method: id ? 'PATCH' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    inventoryHistory: build.query<
      { items: InventoryRecord[]; movements: InventoryMovement[] },
      { q?: string }
    >({ query: (params) => ({ url: '/admin/inventory', params }), providesTags: ['Admin'] }),
    adjustInventory: build.mutation<InventoryMovement, InventoryAdjustment>({
      query: (body) => ({ url: '/admin/inventory/adjustments', method: 'POST', body }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    adminOrders: build.query<Page<Order>, ListQuery>({
      query: (params) => ({
        url: '/admin/orders',
        params: { ...params, status: params.status || undefined },
      }),
      providesTags: ['Admin'],
    }),
    updateOrder: build.mutation<
      Order,
      { id: string; status: OrderStatus; trackingNumber?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Admin', 'Orders'],
    }),
    customers: build.query<Page<Customer>, ListQuery>({
      query: (params) => ({ url: '/admin/customers', params }),
      providesTags: ['Admin'],
    }),
    customer: build.query<{ customer: Customer; orders: Order[] }, string>({
      query: (id) => `/admin/customers/${id}`,
      providesTags: ['Admin'],
    }),
    coupons: build.query<Coupon[], void>({
      query: () => '/admin/coupons',
      providesTags: ['Admin'],
    }),
    saveCoupon: build.mutation<Coupon, { id?: string; data: CouponInput }>({
      query: ({ id, data }) => ({
        url: `/admin/coupons${id ? `/${id}` : ''}`,
        method: id ? 'PATCH' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Admin'],
    }),
    deleteCoupon: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/coupons/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Admin'],
    }),
    taxonomy: build.query<Category[], 'categories' | 'collections'>({
      query: (kind) => `/admin/${kind}`,
      providesTags: ['Admin'],
    }),
    saveTaxonomy: build.mutation<
      Category,
      { kind: 'categories' | 'collections'; id?: string; data: TaxonomyInput }
    >({
      query: ({ kind, id, data }) => ({
        url: `/admin/${kind}${id ? `/${id}` : ''}`,
        method: id ? 'PATCH' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    deleteTaxonomy: build.mutation<void, { kind: 'categories' | 'collections'; id: string }>({
      query: ({ kind, id }) => ({ url: `/admin/${kind}/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    settings: build.query<StoreSettings, void>({
      query: () => '/admin/settings',
      providesTags: ['Admin'],
    }),
  }),
});

export const {
  useDashboardQuery,
  useAdminProductsQuery,
  useSaveProductMutation,
  useInventoryHistoryQuery,
  useAdjustInventoryMutation,
  useAdminOrdersQuery,
  useUpdateOrderMutation,
  useCustomersQuery,
  useCustomerQuery,
  useCouponsQuery,
  useSaveCouponMutation,
  useDeleteCouponMutation,
  useTaxonomyQuery,
  useSaveTaxonomyMutation,
  useDeleteTaxonomyMutation,
  useSettingsQuery,
} = adminApi;
