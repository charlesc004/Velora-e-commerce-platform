import { ArrowRight, ArrowUpRight, PackageCheck, RotateCcw, Leaf, MoveUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newsletterSchema, type NewsletterInput } from '@velora/contracts';
import { toast } from 'sonner';
import { useProductsQuery, useSubscribeMutation } from '../api/catalog.api';
import { ProductGrid } from '../components/ProductGrid';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/utils/errors';
import { usePageMeta } from '@/hooks/usePageMeta';
function Newsletter(): React.JSX.Element {
  const [subscribe, state] = useSubscribeMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewsletterInput>({ resolver: zodResolver(newsletterSchema) });
  return (
    <section className="newsletter">
      <div>
        <p className="eyebrow">A NOTE FROM VELORA</p>
        <h2>
          A little inspiration.
          <br />
          Only when it matters.
        </h2>
        <p>New collections, considered stories, and a first look at what’s next.</p>
      </div>
      <form
        onSubmit={handleSubmit(async (body) => {
          try {
            await subscribe(body).unwrap();
            toast.success('You’re on the list. Welcome to VELORA.');
            reset();
          } catch (error) {
            toast.error(errorMessage(error));
          }
        })}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <div className="newsletter-input">
          <Input
            id="newsletter-email"
            type="email"
            placeholder="Your email address"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            aria-label="Subscribe to newsletter"
            disabled={state.isLoading}
          >
            <ArrowRight size={23} />
          </Button>
        </div>
        {errors.email && (
          <p className="field-error" role="alert">
            {errors.email.message}
          </p>
        )}
        <small>
          By subscribing, you agree to our <Link to="/information/privacy">Privacy Policy</Link>.
        </small>
      </form>
    </section>
  );
}
function ProductSection({
  title,
  subtitle,
  query,
  link,
}: {
  title: string;
  subtitle: string;
  query: string;
  link: string;
}): React.JSX.Element {
  const result = useProductsQuery(query);
  return (
    <section className="section container">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <Link className="text-link" to={link}>
          Explore the edit <ArrowUpRight size={17} />
        </Link>
      </div>
      {result.isLoading ? (
        <LoadingSkeleton />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.refetch} />
      ) : (
        <ProductGrid products={result.data?.items || []} />
      )}
    </section>
  );
}
export default function HomePage(): React.JSX.Element {
  usePageMeta(
    'Considered clothing. Lasting style.',
    'Discover thoughtfully crafted clothing and everyday essentials. Explore the new VELORA autumn collection.',
  );
  return (
    <>
      <section className="hero">
        <img
          className="hero-image"
          src="/images/hero.jpg"
          alt="Autumn tailoring in warm stone surroundings"
          width="1920"
          height="1280"
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="eyebrow">THE AUTUMN EDIT · 2026</p>
          <h1>
            A quieter kind
            <br />
            of statement.
          </h1>
          <p>
            Considered pieces. Effortless presence.
            <br />
            Made for the way you move through life.
          </p>
          <Button asChild size="lg">
            <Link to="/shop?collection=autumn-edit">
              Discover the collection <ArrowUpRight size={17} />
            </Link>
          </Button>
        </motion.div>
        <div className="hero-bottom">
          <span>DESIGNED TO BE WORN. MADE TO BE KEPT.</span>
          <span>
            01 <i /> 03
          </span>
        </div>
      </section>
      <div className="brand-note">
        <span>LESS, BUT BETTER.</span>
        <p>
          A wardrobe that feels like you.
          <br className="mobile-break" /> Today, and for years to come.
        </p>
        <span>THE VELORA PHILOSOPHY</span>
      </div>
      <ProductSection
        title="A fresh perspective."
        subtitle="JUST ARRIVED"
        query="sort=newest&limit=4"
        link="/shop?sort=newest"
      />
      <section className="category-section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR EVERYDAY, ELEVATED</p>
            <h2>Find your point of view.</h2>
          </div>
          <span className="muted desktop-only">A few good things. Endless possibilities.</span>
        </div>
        <div className="category-grid">
          {[
            {
              name: 'For her',
              sub: 'EASE IN EVERY DETAIL',
              image: 'category-women.jpg',
              url: '/shop?gender=women',
            },
            {
              name: 'For him',
              sub: 'THE NEW EVERYDAY',
              image: 'category-men.jpg',
              url: '/shop?gender=men',
            },
            {
              name: 'The finishing touch',
              sub: 'SMALL THINGS, WELL MADE',
              image: 'accessories.jpg',
              url: '/shop?category=accessories',
            },
          ].map((category) => (
            <Link className="category-card" to={category.url} key={category.name}>
              <img
                src={`/images/${category.image}`}
                alt={category.name}
                width="700"
                height="850"
                loading="lazy"
              />
              <div>
                <p className="eyebrow">{category.sub}</p>
                <h3>{category.name}</h3>
                <span className="category-arrow">
                  <ArrowUpRight size={22} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="campaign">
        <div className="campaign-image">
          <img
            src="/images/editorial.jpg"
            alt="Thoughtfully chosen natural fabrics in the VELORA studio"
            width="1200"
            height="1000"
            loading="lazy"
          />
        </div>
        <div className="campaign-copy">
          <p className="eyebrow">THE ART OF EVERYDAY</p>
          <h2>
            Good things
            <br />
            take their time.
          </h2>
          <p>
            Beautiful fabrics. Thoughtful details. Nothing more than you need, and everything you’ll
            reach for again.
          </p>
          <Link className="text-link light" to="/shop?collection=everyday-essentials">
            Meet your new essentials <ArrowUpRight size={18} />
          </Link>
          <span className="campaign-number">VELORA — ESSENTIALS NO. 01</span>
        </div>
      </section>
      <ProductSection
        title="Loved for a reason."
        subtitle="THE PIECES YOU COME BACK TO"
        query="sort=popular&limit=4"
        link="/shop?sort=popular"
      />
      <ProductSection
        title="A few things, just for you."
        subtitle="THE CONSIDERED EDIT"
        query="collection=modern-classics&sort=featured&limit=4"
        link="/shop?collection=modern-classics"
      />
      <section className="story container">
        <p className="eyebrow">A MORE CONSIDERED APPROACH</p>
        <h2>
          Not more in your wardrobe.
          <br />
          <em>More from it.</em>
        </h2>
        <p>
          We believe the best things in life earn their place. That’s why we make pieces with
          purpose: timeless in spirit, thoughtful in detail, and quietly individual.
        </p>
        <Link className="text-link" to="/information/our-story">
          A closer look at VELORA <MoveUpRight size={16} />
        </Link>
      </section>
      <div className="values container">
        <div>
          <PackageCheck size={25} strokeWidth={1} />
          <h3>Thoughtfully delivered</h3>
          <p>Complimentary shipping on orders $150+</p>
        </div>
        <div>
          <RotateCcw size={25} strokeWidth={1} />
          <h3>Time to make it yours</h3>
          <p>Easy returns within 30 days</p>
        </div>
        <div>
          <Leaf size={25} strokeWidth={1} />
          <h3>Made with intention</h3>
          <p>Considered materials. Lasting quality.</p>
        </div>
      </div>
      <div className="container">
        <Newsletter />
      </div>
    </>
  );
}
