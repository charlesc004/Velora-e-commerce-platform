import { lazy, Suspense, useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  useRouteError,
  Link,
} from 'react-router-dom';
import StoreLayout from '@/layouts/StoreLayout';
import AccountLayout from '@/layouts/AccountLayout';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
const HomePage = lazy(() => import('@/features/catalog/pages/HomePage'));
const ShopPage = lazy(() => import('@/features/catalog/pages/ShopPage'));
const ProductPage = lazy(() => import('@/features/catalog/pages/ProductPage'));
const AuthPage = lazy(() => import('@/features/auth/pages/AuthPage'));
const CartPage = lazy(() => import('@/features/cart/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'));
const OrderPage = lazy(() => import('@/features/orders/OrderPage'));
const WishlistPage = lazy(() => import('@/features/wishlist/WishlistPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const InformationPage = lazy(() => import('@/features/content/InformationPage'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
function Root(): React.JSX.Element {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return (
    <Suspense
      fallback={
        <div className="container section">
          <LoadingSkeleton />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}
function Guard({ admin = false }: { admin?: boolean }): React.JSX.Element {
  const { data: user, isLoading, error, refetch } = useMeQuery();
  const location = useLocation();
  if (isLoading)
    return (
      <div className="container section">
        <LoadingSkeleton count={2} />
      </div>
    );
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!user)
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (admin && user.role !== 'admin')
    return (
      <div className="container section">
        <EmptyState
          title="A little beyond your wardrobe."
          description="Administration is available to authorized team members."
        >
          <Button asChild>
            <Link to="/">Back to VELORA</Link>
          </Button>
        </EmptyState>
      </div>
    );
  return <Outlet />;
}
function RouteError(): React.JSX.Element {
  const error = useRouteError();
  return (
    <div className="container section">
      <ErrorState error={error} />
      <Button asChild>
        <a href="/">Back to VELORA</a>
      </Button>
    </div>
  );
}
function NotFound(): React.JSX.Element {
  return (
    <div className="container section">
      <EmptyState
        title="A little off the beaten path."
        description="We couldn’t find this page, but there’s plenty to discover."
      >
        <Button asChild>
          <Link to="/shop">Explore the collection</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <StoreLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'shop', element: <ShopPage /> },
          { path: 'product/:slug', element: <ProductPage /> },
          { path: 'cart', element: <CartPage /> },
          { path: 'checkout', element: <CheckoutPage /> },
          { path: 'orders/:id', element: <OrderPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'login', element: <AuthPage /> },
          { path: 'register', element: <AuthPage mode="register" /> },
          { path: 'information/:slug', element: <InformationPage /> },
          {
            element: <Guard />,
            children: [
              {
                path: 'account',
                element: <AccountLayout />,
                children: [
                  { index: true, element: <AccountPage /> },
                  { path: ':section', element: <AccountPage /> },
                ],
              },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        element: <Guard admin />,
        children: [
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminPage /> },
              { path: ':section', element: <AdminPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
