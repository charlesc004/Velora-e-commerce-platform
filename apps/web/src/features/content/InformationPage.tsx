import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
const pages: Record<
  string,
  { eyebrow: string; title: string; intro: string; sections: { title: string; body: string }[] }
> = {
  'our-story': {
    eyebrow: 'THE VELORA PHILOSOPHY',
    title: 'Less, with a little more meaning.',
    intro:
      'We started with a simple thought: your wardrobe should make life feel easier. Fewer decisions. Better pieces. More room for you.',
    sections: [
      {
        title: 'An everyday point of view',
        body: 'VELORA is a fictional fashion house exploring a more considered wardrobe. The collection brings together quiet silhouettes, beautiful textures, and pieces that feel familiar from the very first wear.',
      },
      {
        title: 'Designed to find their place',
        body: 'We favor adaptable shapes and a restrained palette. Pieces that work together, wear easily, and leave space for your own point of view. No rush. No unnecessary detail.',
      },
    ],
  },
  shipping: {
    eyebrow: 'THOUGHTFULLY DELIVERED',
    title: 'Good things, on their way.',
    intro:
      'A little care goes into every delivery. Here is what to expect from our demo storefront.',
    sections: [
      {
        title: 'Standard delivery',
        body: 'Standard delivery costs $8 and takes an estimated 4–7 business days. It is complimentary when your merchandise subtotal after discounts reaches $150.',
      },
      {
        title: 'Express delivery',
        body: 'For a little less waiting, choose express delivery for $18. Estimated arrival is 2–3 business days. These are illustrative delivery terms; demo orders do not result in a physical shipment.',
      },
      {
        title: 'Your order, at a glance',
        body: 'Find payment and fulfillment status in your account order history. Guest customers can revisit the private order link provided at checkout. Tax is estimated at 8% for this demonstration.',
      },
    ],
  },
  returns: {
    eyebrow: 'TIME TO MAKE IT YOURS',
    title: 'A little room to reconsider.',
    intro:
      'A good fit should feel effortless. Our demonstration returns policy gives you time to decide.',
    sections: [
      {
        title: 'Our 30-day window',
        body: 'Unworn, unwashed pieces in original condition can be considered for return within 30 days of delivery. Keep all original labels and packaging. This storefront records demo transactions only.',
      },
      {
        title: 'Getting started',
        body: 'Locate your order number in your account or guest order link. Contact the project operator with the order number and reason for your request. Automated return labels and refund processing are not available in this demo.',
      },
    ],
  },
  care: {
    eyebrow: 'KEEP THE GOOD THINGS GOOD',
    title: 'Made to be kept.',
    intro: 'A little attention goes a long way. Give your favorite pieces the care they deserve.',
    sections: [
      {
        title: 'Knitwear',
        body: 'Air between wears and wash only when needed. Follow the care label, use a gentle detergent, and dry flat away from heat. Store folded to preserve the shape.',
      },
      {
        title: 'Linen & cotton',
        body: 'Wash cool with similar colors. Reshape while damp and line dry when possible. Natural creases are part of linen’s easy character.',
      },
      {
        title: 'Tailoring & accessories',
        body: 'Use a shaped hanger for jackets and coats. Brush gently between wears. Protect leather accessories from rain and direct sunlight; use care products suited to the material.',
      },
    ],
  },
  materials: {
    eyebrow: 'MADE WITH INTENTION',
    title: 'Start with something good.',
    intro: 'Texture, touch, and the way a piece moves. The details you feel before you notice.',
    sections: [
      {
        title: 'A considered palette',
        body: 'Our fictional collection explores wool, cashmere, linen, cotton, and leather. Read each product description and garment label for specific materials. Photography represents an editorial mood rather than certified product specifications.',
      },
      {
        title: 'Honest by design',
        body: 'This portfolio project does not claim environmental certification or audited supply chains. It demonstrates a product experience built around useful information and thoughtful choices.',
      },
    ],
  },
  contact: {
    eyebrow: 'A LITTLE HELP, WHEN YOU NEED IT',
    title: 'Let’s make it easy.',
    intro: 'Find answers about your VELORA account, orders, and the collection.',
    sections: [
      {
        title: 'Your order',
        body: 'Open your order from your account history to see payment and fulfillment details. If you checked out as a guest, use the private order link from your confirmation page.',
      },
      {
        title: 'About this storefront',
        body: 'VELORA is a portfolio application. Demo payments do not charge a card or ship products. For support, contact the project operator through the channel where this application was shared.',
      },
    ],
  },
  privacy: {
    eyebrow: 'YOUR DETAILS, CONSIDERED',
    title: 'A little transparency.',
    intro:
      'This demonstration stores the details you choose to share so the shopping experience works.',
    sections: [
      {
        title: 'What is stored',
        body: 'Your profile, saved addresses, wishlist, shopping cart, reviews, newsletter subscription, and order details are stored in the application database. Passwords are hashed. Authentication uses HttpOnly cookies; card details are never collected by this application.',
      },
      {
        title: 'Browser storage',
        body: 'Your guest bag is stored in your browser so it can be there when you return. Clearing site data removes the guest bag. Private guest order links contain an access token and should be treated like personal information.',
      },
      {
        title: 'Your choices',
        body: 'Update your profile and addresses in your account. Newsletter removal and account deletion require contacting the project operator. Use fictional details while exploring the demo.',
      },
    ],
  },
  terms: {
    eyebrow: 'A FEW USEFUL DETAILS',
    title: 'Our demonstration terms.',
    intro:
      'VELORA is a fictional, portfolio-grade application for exploring a complete commerce workflow.',
    sections: [
      {
        title: 'Demo transactions',
        body: 'Mock payments simulate purchase outcomes and do not charge money. Stripe integration is intended for test keys and test cards. Products and personal details are fictional; orders are not physically fulfilled.',
      },
      {
        title: 'Prices & availability',
        body: 'Prices are shown in USD. The server validates discounts, inventory, shipping, and tax at checkout. An order reserves inventory for a limited period before payment; expired or failed reservations restore availability.',
      },
      {
        title: 'Appropriate use',
        body: 'Explore the application with fictional information. Demo administrator accounts are intended for local development only. The project operator is responsible for reviewing the application before any real commercial use.',
      },
    ],
  },
};
export default function InformationPage(): React.JSX.Element {
  const { slug = 'our-story' } = useParams();
  const page = Object.hasOwn(pages, slug) ? pages[slug] : undefined;
  usePageMeta(page?.title || 'A little help');
  if (!page)
    return (
      <div className="container section">
        <h1>A little off the beaten path.</h1>
        <Link to="/">Back to VELORA</Link>
      </div>
    );
  return (
    <article className="information-page container">
      <div className="information-heading">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </div>
      {slug === 'our-story' && (
        <img
          className="story-image"
          src="/images/editorial.jpg"
          alt="Natural fabrics in the VELORA atelier"
          width="1200"
          height="650"
        />
      )}
      <div className="information-body">
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <Link className="text-link" to="/shop">
          Back to the collection <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
