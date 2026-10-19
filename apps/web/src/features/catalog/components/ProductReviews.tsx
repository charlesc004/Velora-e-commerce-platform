import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, BadgeCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reviewSchema, type ReviewInput } from '@velora/contracts';
import { useReviewsQuery, useAddReviewMutation } from '../api/catalog.api';
import { useMeQuery } from '@/features/auth/api/auth.api';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/shared/ErrorState';
import { date } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { toast } from 'sonner';
export function ProductReviews({ productId }: { productId: string }): React.JSX.Element {
  const result = useReviewsQuery(productId);
  const { data: user } = useMeQuery();
  const [open, setOpen] = useState(false);
  const [addReview, state] = useAddReviewMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: 5 } });
  return (
    <section className="reviews-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">FROM YOUR EVERYDAY</p>
          <h2>A few honest words.</h2>
        </div>
        {user ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Write a review
          </Button>
        ) : (
          <Link className="text-link" to="/login">
            Sign in to leave a review
          </Link>
        )}
      </div>
      {result.error ? (
        <ErrorState error={result.error} retry={result.refetch} />
      ) : result.isLoading ? (
        <p className="muted">Loading reviews…</p>
      ) : !result.data?.length ? (
        <p className="muted">
          The first word could be yours. Tell us how it fits into your everyday.
        </p>
      ) : (
        <div className="reviews-grid">
          {result.data.map((review) => (
            <article className="review-card" key={review.id}>
              <div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={13} fill={i < review.rating ? 'currentColor' : 'none'} />
                ))}
              </div>
              <h3>{review.title}</h3>
              <p>{review.body}</p>
              <div className="review-author">
                <span>
                  {review.name}
                  {review.verified && <BadgeCheck size={14} />}
                </span>
                <time>{date(review.createdAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Your perspective matters."
        description="Share a thoughtful review of this piece."
      >
        <form
          className="form-stack"
          onSubmit={handleSubmit(async (review) => {
            try {
              await addReview({ productId, review }).unwrap();
              toast.success('Thank you for sharing your perspective.');
              reset();
              setOpen(false);
            } catch (error) {
              toast.error(errorMessage(error));
            }
          })}
        >
          <Field label="Rating" error={errors.rating?.message}>
            <Select {...register('rating', { valueAsNumber: true })}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" error={errors.title?.message}>
            <Input {...register('title')} />
          </Field>
          <Field label="Your review" error={errors.body?.message}>
            <Textarea rows={5} {...register('body')} />
          </Field>
          <Button disabled={state.isLoading} type="submit">
            Share your review
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
