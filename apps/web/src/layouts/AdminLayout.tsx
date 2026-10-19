import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Boxes,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShoppingBag,
  Tag,
  Tags,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import '@/features/admin/admin.css';

const navigation = [
  { label: 'Overview', path: '', icon: LayoutDashboard },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'Orders', path: '/orders', icon: ShoppingBag },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Discounts', path: '/discounts', icon: Tag },
  { label: 'Collections', path: '/collections', icon: Tags },
  { label: 'Categories', path: '/categories', icon: Tags },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings2 },
];

function AdminNavigation({ onNavigate }: { onNavigate: () => void }): React.JSX.Element {
  return (
    <nav aria-label="Administration">
      {navigation.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={label}
          to={`/admin${path}`}
          end={path === ''}
          onClick={onNavigate}
          className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
        >
          <Icon size={18} strokeWidth={1.6} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { data: user } = useMeQuery();
  const { signOut, isLoading } = useSignOut();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand">
          VELORA<span>THE WORKSPACE</span>
        </Link>
        <div className="admin-store-label">
          <span className="admin-status-dot" /> Velora flagship{' '}
          <span className="admin-live-label">LIVE</span>
        </div>
        <div className="admin-nav-caption">MANAGE YOUR BUSINESS</div>
        <AdminNavigation onNavigate={() => setOpen(false)} />
        <div className="admin-sidebar-bottom">
          <Link to="/" className="admin-store-link">
            <ChevronLeft size={16} /> Visit storefront <ArrowUpRight size={15} />
          </Link>
          <div className="admin-profile">
            <div className="admin-avatar">{user?.name?.slice(0, 1) || 'V'}</div>
            <div>
              <strong>{user?.name || 'Administrator'}</strong>
              <small>Store administrator</small>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Sign out"
              disabled={isLoading}
              onClick={signOut}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <Button
              size="icon"
              variant="ghost"
              className="admin-menu-button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span>Workspace</span>
            <span className="admin-breadcrumb-slash">/</span>
            <strong>Velora</strong>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-environment">
              <span className="admin-status-dot" /> Store is live
            </span>
            <Link to="/" className="admin-topbar-store">
              View store <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
        <footer className="admin-footer">
          <span>VELORA COMMERCE</span>
          <span>Thoughtfully made. Carefully managed.</span>
        </footer>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="VELORA workspace"
        description="Manage your store."
      >
        <AdminNavigation onNavigate={() => setOpen(false)} />
        <Button variant="ghost" disabled={isLoading} onClick={signOut}>
          <LogOut size={16} /> Sign out
        </Button>
      </Dialog>
    </div>
  );
}
