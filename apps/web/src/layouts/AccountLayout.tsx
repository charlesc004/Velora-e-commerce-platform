import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut, ArrowUpRight } from 'lucide-react';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { Button } from '@/components/ui/button';
export default function AccountLayout(): React.JSX.Element {
  const { data: user } = useMeQuery();
  const { signOut, isLoading } = useSignOut();
  return (
    <div className="container section account-layout">
      <aside>
        <p className="eyebrow">YOUR WORLD OF VELORA</p>
        <h1>Hello, {user?.name.split(' ')[0]}.</h1>
        <nav aria-label="Account navigation">
          {[
            { to: '/account', label: 'Your details', end: true },
            { to: '/account/orders', label: 'Your orders' },
            { to: '/account/addresses', label: 'Address book' },
            { to: '/account/security', label: 'Password & security' },
          ].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
              <ArrowUpRight size={14} />
            </NavLink>
          ))}
          <Link to="/wishlist">
            Your wishlist
            <ArrowUpRight size={14} />
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin">
              Administration
              <ArrowUpRight size={14} />
            </Link>
          )}
        </nav>
        <Button variant="ghost" disabled={isLoading} onClick={signOut}>
          <LogOut size={15} /> Sign out
        </Button>
      </aside>
      <div className="account-content">
        <Outlet />
      </div>
    </div>
  );
}
