import type {
  Product,
  Page,
  Category,
  Collection,
  Review,
  ReviewInput,
  CatalogFacets,
} from '@velora/contracts';
import { baseApi } from '@/lib/api/baseApi';
export const catalogApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    products: builder.query<Page<Product>, string>({
      query: (params) => `/products?${params}`,
      providesTags: ['Catalog'],
    }),
    product: builder.query<Product, string>({
      query: (slug) => `/products/${encodeURIComponent(slug)}`,
      providesTags: ['Catalog'],
    }),
    categories: builder.query<Category[], void>({
      query: () => '/categories',
      providesTags: ['Catalog'],
    }),
    catalogFacets: builder.query<CatalogFacets, void>({
      query: () => '/products/facets',
      providesTags: ['Catalog'],
    }),
    collections: builder.query<Collection[], void>({
      query: () => '/collections',
      providesTags: ['Catalog'],
    }),
    reviews: builder.query<Review[], string>({
      query: (id) => `/products/${id}/reviews`,
      providesTags: ['Reviews'],
    }),
    addReview: builder.mutation<Review, { productId: string; review: ReviewInput }>({
      query: ({ productId, review }) => ({
        url: `/products/${productId}/reviews`,
        method: 'POST',
        body: review,
      }),
      invalidatesTags: ['Reviews', 'Catalog'],
    }),
    subscribe: builder.mutation<void, { email: string }>({
      query: (body) => ({ url: '/newsletter', method: 'POST', body }),
    }),
  }),
});
export const {
  useProductsQuery,
  useProductQuery,
  useCategoriesQuery,
  useCatalogFacetsQuery,
  useCollectionsQuery,
  useReviewsQuery,
  useAddReviewMutation,
  useSubscribeMutation,
} = catalogApi;
