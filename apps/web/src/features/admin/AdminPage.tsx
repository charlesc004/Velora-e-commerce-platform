import { lazy, Suspense, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { usePageMeta } from '@/hooks/usePageMeta';

const DashboardPage = lazy(() => import('./dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('./products/ProductsPage'));
const InventoryPage = lazy(() => import('./inventory/InventoryPage'));
const OrdersPage = lazy(() => import('./orders/OrdersPage'));
const CustomersPage = lazy(() => import('./customers/CustomersPage'));
const DiscountsPage = lazy(() => import('./discounts/DiscountsPage'));
const TaxonomyPage = lazy(() => import('./taxonomy/TaxonomyPage'));
const SettingsPage = lazy(() => import('./settings/SettingsPage'));

export default function AdminPage() {
  const { section } = useParams();
  usePageMeta(`Workspace · ${section ? section[0].toUpperCase() + section.slice(1) : 'Overview'}`);
  let content: ReactNode;
  switch (section) {
    case undefined:
      content = <DashboardPage />;
      break;
    case 'analytics':
      content = <DashboardPage analytics />;
      break;
    case 'products':
      content = <ProductsPage />;
      break;
    case 'inventory':
      content = <InventoryPage />;
      break;
    case 'orders':
      content = <OrdersPage />;
      break;
    case 'customers':
      content = <CustomersPage />;
      break;
    case 'discounts':
      content = <DiscountsPage />;
      break;
    case 'categories':
      content = <TaxonomyPage key="categories" kind="categories" />;
      break;
    case 'collections':
      content = <TaxonomyPage key="collections" kind="collections" />;
      break;
    case 'settings':
      content = <SettingsPage />;
      break;
    default:
      content = (
        <EmptyState
          title="This workspace page could not be found"
          description="Choose a section from the navigation to continue."
        />
      );
  }
  return <Suspense fallback={<LoadingSkeleton count={3} />}>{content}</Suspense>;
}
