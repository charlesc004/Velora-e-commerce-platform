import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, passwordChangeSchema, checkoutSchema, type User } from '@velora/contracts';
import type { z } from 'zod';
import { Plus, X, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from '@/features/auth/api/auth.api';
import { useOrdersQuery } from '@/features/orders/orders.api';
import { AddressForm, type CustomerDetails } from '@/components/shared/AddressForm';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Pagination } from '@/components/shared/Pagination';
import { date } from '@/lib/utils/date';
import { money } from '@/lib/utils/currency';
import { errorMessage } from '@/lib/utils/errors';
import { usePageMeta } from '@/hooks/usePageMeta';
function Profile({ user }: { user: User }): React.JSX.Element {
  const [update, state] = useUpdateProfileMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });
  return (
    <>
      <PageHeader
        title="The details that make you, you."
        description="Keep your account feeling like home."
      />
      <form
        className="form-stack account-form"
        onSubmit={handleSubmit(async (input) => {
          try {
            await update(input).unwrap();
            toast.success('Your details are up to date.');
          } catch (error) {
            toast.error(errorMessage(error));
          }
        })}
      >
        <Field label="Full name" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="Email address">
          <Input type="email" value={user.email} readOnly />
        </Field>
        <p className="field-hint">Your sign-in email stays connected to your order history.</p>
        <Button type="submit" disabled={state.isLoading}>
          Save your details
        </Button>
      </form>
      <p className="account-since">Part of VELORA since {date(user.createdAt)}.</p>
    </>
  );
}
function Security(): React.JSX.Element {
  const [change, state] = useChangePasswordMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
  });
  return (
    <>
      <PageHeader
        title="A little peace of mind."
        description="Choose a strong password that’s just yours."
      />
      <form
        className="form-stack account-form"
        onSubmit={handleSubmit(async (input) => {
          try {
            await change(input).unwrap();
            reset();
            toast.success('Your password has been changed.');
          } catch (error) {
            toast.error(errorMessage(error));
          }
        })}
      >
        <Field label="Current password" error={errors.currentPassword?.message}>
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="New password" error={errors.newPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <p className="field-hint">
          At least 10 characters, including an uppercase letter and a number.
        </p>
        <Button type="submit" disabled={state.isLoading}>
          Update password
        </Button>
      </form>
    </>
  );
}
function Orders(): React.JSX.Element {
  const [page, setPage] = useState(1);
  const result = useOrdersQuery(page);
  return (
    <>
      <PageHeader
        title="A history of good choices."
        description="All your VELORA orders, in one place."
      />
      {result.error ? (
        <ErrorState error={result.error} retry={result.refetch} />
      ) : result.isLoading ? (
        <p role="status">Finding your orders…</p>
      ) : !result.data?.items.length ? (
        <EmptyState
          title="Your first chapter awaits."
          description="Your orders will find a home here."
        >
          <Button asChild>
            <Link to="/shop">Explore the collection</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="account-orders">
          {result.data.items.map((order) => (
            <Link to={`/orders/${order.id}`} key={order.id} className="account-order">
              <div>
                <p className="eyebrow">{order.number}</p>
                <span className="muted">{date(order.createdAt)}</span>
              </div>
              <div className="order-mini-images">
                {order.items.slice(0, 3).map((item, i) => (
                  <img src={item.image} alt={item.name} key={i} width="50" height="65" />
                ))}
              </div>
              <div>
                <strong>{money(order.totals.total)}</strong>
                <Badge>{order.status}</Badge>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      )}
      <Pagination page={page} pages={result.data?.pages || 1} onChange={setPage} />
    </>
  );
}
function Addresses({ user }: { user: User }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [update, state] = useUpdateProfileMutation();
  const form = useForm<CustomerDetails>({
    resolver: zodResolver(checkoutSchema.pick({ email: true, address: true })),
    defaultValues: {
      email: user.email,
      address: {
        name: user.name,
        line1: '',
        line2: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'US',
      },
    },
  });
  async function remove(index: number): Promise<void> {
    try {
      await update({
        name: user.name,
        addresses: user.addresses.filter((_, i) => i !== index),
      }).unwrap();
      toast.success('Address removed.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <>
      <PageHeader title="Where good things find you." description="A few familiar places.">
        <Button
          disabled={user.addresses.length >= 8}
          onClick={() => {
            setEditing(null);
            form.reset({
              email: user.email,
              address: {
                name: user.name,
                line1: '',
                line2: '',
                city: '',
                region: '',
                postalCode: '',
                country: 'US',
              },
            });
            setOpen(true);
          }}
        >
          <Plus size={15} /> Add address
        </Button>
      </PageHeader>
      <div className="address-grid">
        {user.addresses.map((address, i) => (
          <article className="address-card" key={i}>
            <p className="eyebrow">{i === 0 ? 'DEFAULT ADDRESS' : `ADDRESS ${i + 1}`}</p>
            <h3>{address.name}</h3>
            <p>
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.city}, {address.region} {address.postalCode}
              <br />
              {address.country}
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(i);
                  form.reset({ email: user.email, address });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={state.isLoading}
                aria-label={`Remove address ${i + 1}`}
                onClick={() => void remove(i)}
              >
                <X size={14} /> Remove
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!user.addresses.length && (
        <EmptyState
          title="Make yourself at home."
          description="Save an address to make next time a little easier."
        />
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={editing === null ? 'A new place.' : 'Update this address.'}
      >
        <form
          onSubmit={form.handleSubmit(async ({ address }) => {
            try {
              const addresses = [...user.addresses];
              if (editing === null) addresses.push(address);
              else addresses[editing] = address;
              await update({ name: user.name, addresses }).unwrap();
              setOpen(false);
              toast.success('Your address book is up to date.');
            } catch (error) {
              toast.error(errorMessage(error));
            }
          })}
          className="form-stack"
        >
          <AddressForm
            register={form.register}
            errors={form.formState.errors}
            includeEmail={false}
          />
          <Button type="submit" disabled={state.isLoading}>
            Save address
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export default function AccountPage(): React.JSX.Element {
  const { section } = useParams();
  const { data: user } = useMeQuery();
  usePageMeta(
    section === 'orders'
      ? 'Your orders'
      : section === 'addresses'
        ? 'Your address book'
        : section === 'security'
          ? 'Password & security'
          : 'Your account',
  );
  if (!user) return <p role="status">Finding your account…</p>;
  if (section === 'orders') return <Orders />;
  if (section === 'addresses') return <Addresses user={user} />;
  if (section === 'security') return <Security />;
  return <Profile user={user} key={user.id} />;
}
