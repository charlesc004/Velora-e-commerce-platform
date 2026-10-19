import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, passwordChangeSchema, type User } from '@velora/contracts';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { money } from '@/lib/utils/currency';
import { errorMessage } from '@/lib/utils/errors';
import {
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from '@/features/auth/api/auth.api';
import { useSettingsQuery } from '../api/admin.api';

export default function SettingsPage() {
  const { data, isLoading, error, refetch } = useSettingsQuery();
  const { data: user } = useMeQuery();
  return (
    <>
      <PageHeader title="Settings" description="Your store essentials and account preferences." />
      {isLoading ? (
        <LoadingSkeleton count={2} />
      ) : error || !data ? (
        <ErrorState error={error} retry={refetch} />
      ) : (
        <div className="admin-settings-grid">
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>Store details</h2>
                <p>The essentials behind your storefront</p>
              </div>
            </div>
            <div className="admin-settings-body">
              <div className="admin-settings-line">
                <span>Store name</span>
                <strong>{data.storeName}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Store currency</span>
                <strong>{data.currency} · US Dollar</strong>
              </div>
              <div className="admin-settings-line">
                <span>Payment methods</span>
                <strong>
                  {data.paymentMethods
                    .map((method) => (method === 'mock' ? 'Mock checkout' : 'Stripe Checkout'))
                    .join(', ')}
                </strong>
              </div>
              <div className="admin-settings-line">
                <span>Administrator</span>
                <strong>{user?.email}</strong>
              </div>
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>Shipping & tax policy</h2>
                <p>Applied automatically at checkout</p>
              </div>
            </div>
            <div className="admin-settings-body">
              <div className="admin-settings-line">
                <span>Standard shipping</span>
                <strong>{money(data.shipping.standard)}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Express shipping</span>
                <strong>{money(data.shipping.express)}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Free standard shipping from</span>
                <strong>{money(data.shipping.freeThreshold)}</strong>
              </div>
              <div className="admin-settings-line">
                <span>Sales tax</span>
                <strong>
                  {new Intl.NumberFormat('en-US', { style: 'percent' }).format(data.taxRate)}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}
      {user && (
        <div className="admin-settings-grid">
          <ProfileForm user={user} />
          <PasswordForm />
        </div>
      )}
    </>
  );
}

function ProfileForm({ user }: { user: User }) {
  const [update, { isLoading }] = useUpdateProfileMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name },
  });
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Your profile</h2>
          <p>How your name appears in the workspace</p>
        </div>
      </div>
      <form
        className="admin-form admin-settings-body"
        onSubmit={handleSubmit(async (data) => {
          try {
            await update(data).unwrap();
            toast.success('Profile updated');
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        })}
      >
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field label="Email address">
          <Input disabled value={user.email} />
        </Field>
        <div>
          <Button size="sm" type="submit" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function PasswordForm() {
  const [change, { isLoading }] = useChangePasswordMutation();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Account security</h2>
          <p>A strong password keeps your workspace yours</p>
        </div>
      </div>
      <form
        className="admin-form admin-settings-body"
        onSubmit={handleSubmit(async (data) => {
          try {
            await change(data).unwrap();
            toast.success('Password changed');
            reset();
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        })}
      >
        <Field label="Current password" error={errors.currentPassword?.message}>
          <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="New password" error={errors.newPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <p>Use at least 10 characters, including an uppercase letter and a number.</p>
        <div>
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? 'Updating…' : 'Change password'}
          </Button>
        </div>
      </form>
    </section>
  );
}
