import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
const rawQuery = fetchBaseQuery({ baseUrl: '/api/v1', credentials: 'include' });
let refreshRequest: ReturnType<typeof rawQuery> | null = null;
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawQuery(args, api, extraOptions);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status === 401 && !/auth\/(login|register|refresh|logout)/.test(url)) {
    if (!refreshRequest)
      refreshRequest = rawQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);
    const refreshed = await refreshRequest;
    refreshRequest = null;
    if (!refreshed.error) result = await rawQuery(args, api, extraOptions);
    else {
      if (url === '/auth/me') return { data: null };
      api.dispatch(baseApi.util.invalidateTags(['Auth']));
    }
  }
  if ('data' in result && result.data && typeof result.data === 'object' && 'data' in result.data)
    return { data: (result.data as { data: unknown }).data };
  return result;
};
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Auth', 'Catalog', 'Cart', 'Wishlist', 'Orders', 'Reviews', 'Admin'],
  endpoints: () => ({}),
});
