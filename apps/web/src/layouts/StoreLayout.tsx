import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Search, UserRound, ShoppingBag, Heart, Menu, ArrowUpRight } from 'lucide-react';
import { useCart } from '@/features/cart/hooks/useCart';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const navigation = [
  { label: 'New in', to: '/shop?sort=newest' },
  { label: 'Women', to: '/shop?gender=women' },
  { label: 'Men', to: '/shop?gender=men' },
  { label: 'Essentials', to: '/shop?collection=everyday-essentials' },
  { label: 'Our story', to: '/information/our-story' },
];
export default function StoreLayout(): React.JSX.Element {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { count } = useCart();
  const { data: user } = useMeQuery();
  const navigate = useNavigate();
  function search(event: FormEvent): void {
    event.preventDefault();
    setSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="announcement">
        <span>Considered style. Complimentary shipping on orders $150+</span>
        <Link to="/information/shipping">
          Discover more <ArrowUpRight size={12} />
        </Link>
      </div>
      <header className="store-header">
        <div className="header-inner">
          <button
            className="icon-button mobile-menu-trigger"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          <Link to="/" className="wordmark" aria-label="VELORA home">
            VELORA<span>THE ART OF EVERYDAY</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {navigation.map((item) => (
              <NavLink key={item.label} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Search products"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={21} strokeWidth={1.3} />
            </button>
            <Link
              to={user ? '/account' : '/login'}
              className="icon-button account-icon"
              aria-label="My account"
            >
              <UserRound size={20} strokeWidth={1.3} />
            </Link>
            <Link to="/wishlist" className="icon-button wishlist-icon" aria-label="Wishlist">
              <Heart size={20} strokeWidth={1.3} />
            </Link>
            <Link
              to="/cart"
              className="icon-button cart-indicator"
              aria-label={`Shopping bag, ${count} items`}
            >
              <ShoppingBag size={20} strokeWidth={1.3} />
              <span>{count}</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="store-footer container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="wordmark">
              VELORA
            </Link>
            <p>
              Considered clothing. Lasting style.
              <br />
              The art of everyday.
            </p>
          </div>
          <div>
            <h3>EXPLORE</h3>
            <Link to="/shop">All pieces</Link>
            <Link to="/shop?gender=women">Women</Link>
            <Link to="/shop?gender=men">Men</Link>
            <Link to="/shop?collection=everyday-essentials">Essentials</Link>
          </div>
          <div>
            <h3>HERE TO HELP</h3>
            <Link to="/information/shipping">Shipping & delivery</Link>
            <Link to="/information/returns">Returns & exchanges</Link>
            <Link to="/information/care">Care guide</Link>
            <Link to="/account/orders">Your orders</Link>
          </div>
          <div>
            <h3>THE WORLD OF VELORA</h3>
            <Link to="/information/our-story">Our story</Link>
            <Link to="/information/materials">Materials & intention</Link>
            <Link to="/information/contact">Contact us</Link>
            {user?.role === 'admin' && (
              <Link to="/admin">
                Administration <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} VELORA. A considered collection.</span>
          <div>
            <Link to="/information/privacy">Privacy</Link>
            <Link to="/information/terms">Terms</Link>
            <span>United States · USD $</span>
          </div>
        </div>
      </footer>
      <Dialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Find something to live in."
        description="Search the VELORA collection."
      >
        <form onSubmit={search} className="search-dialog-form">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try cashmere, linen, or a favorite piece…"
            aria-label="Search collection"
            autoFocus
          />
          <Button type="submit">
            <Search size={18} /> Search
          </Button>
        </form>
        <p className="eyebrow search-suggestions">A GOOD PLACE TO START</p>
        <div className="search-tags">
          {['knitwear', 'outerwear', 'accessories'].map((tag) => (
            <Link key={tag} to={`/shop?category=${tag}`} onClick={() => setSearchOpen(false)}>
              {tag} <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      </Dialog>
      {menuOpen && (
        <Dialog open={menuOpen} onOpenChange={setMenuOpen} title="VELORA">
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)}>
                {item.label}
                <ArrowUpRight size={22} />
              </Link>
            ))}
            <Link to="/wishlist" onClick={() => setMenuOpen(false)}>
              Your wishlist <Heart size={20} />
            </Link>
            <Link to={user ? '/account' : '/login'} onClick={() => setMenuOpen(false)}>
              Your account <UserRound size={20} />
            </Link>
          </nav>
        </Dialog>
      )}
    </>
  );
}
