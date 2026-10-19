import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { couponSchema, type Coupon, type CouponInput } from '@velora/contracts';
import { Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { money } from '@/lib/utils/currency';
import { date } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { useCouponsQuery, useDeleteCouponMutation, useSaveCouponMutation } from '../api/admin.api';

export default function DiscountsPage() {
  const [editor, setEditor] = useState<Coupon | 'new' | null>(null);
  const { data, isLoading, error, refetch } = useCouponsQuery();
  const [save, { isLoading: saving }] = useSaveCouponMutation();
  const [deactivate, { isLoading: removing }] = useDeleteCouponMutation();
  const toggle = async (coupon: Coupon) => {
    try {
      if (coupon.active) await deactivate(coupon.id).unwrap();
      else await save({ id: coupon.id, data: { ...coupon, active: true } }).unwrap();
      toast.success(coupon.active ? 'Discount deactivated' : 'Discount activated');
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  };
  return (
    <>
      <PageHeader title="Discounts" description="A little incentive. A lasting impression.">
        <Button size="sm" onClick={() => setEditor('new')}>
          <Plus size={15} /> Create discount
        </Button>
      </PageHeader>
      <div style={{ marginTop: 25 }}>
        {isLoading ? (
          <LoadingSkeleton count={3} />
        ) : error ? (
          <ErrorState error={error} retry={refetch} />
        ) : (
          <section className="admin-panel admin-table">
            <DataTable
              rows={data ?? []}
              keyFor={(coupon) => coupon.id}
              empty="Create your first discount to welcome customers."
              columns={[
                {
                  key: 'code',
                  header: 'Discount code',
                  render: (coupon) => <strong className="admin-inline-code">{coupon.code}</strong>,
                },
                {
                  key: 'value',
                  header: 'Offer',
                  render: (coupon) => (
                    <>
                      <strong>
                        {coupon.type === 'percentage'
                          ? `${coupon.value}% off`
                          : `${money(coupon.value)} off`}
                      </strong>
                      <small>
                        {coupon.minimum ? `Minimum ${money(coupon.minimum)}` : 'No minimum spend'}
                      </small>
                    </>
                  ),
                },
                {
                  key: 'used',
                  header: 'Usage',
                  render: (coupon) => `${coupon.used} / ${coupon.usageLimit}`,
                },
                {
                  key: 'expiration',
                  header: 'Expires',
                  render: (coupon) => (coupon.expiresAt ? date(coupon.expiresAt) : 'No expiry'),
                },
                {
                  key: 'active',
                  header: 'Status',
                  render: (coupon) => (
                    <Badge
                      style={{
                        fontSize: 9,
                        color: coupon.active ? '#68865c' : '#989e90',
                        background: coupon.active ? '#eef4e9' : '#f1f2ee',
                        border: 0,
                      }}
                    >
                      {coupon.active ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (coupon) => (
                    <div className="admin-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${coupon.code}`}
                        onClick={() => setEditor(coupon)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving || removing}
                        onClick={() => toggle(coupon)}
                      >
                        {coupon.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        )}
      </div>
      {editor && (
        <DiscountEditor
          coupon={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}

function DiscountEditor({ coupon, onClose }: { coupon?: Coupon; onClose: () => void }) {
  const [save, { isLoading }] = useSaveCouponMutation();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CouponInput>({
    resolver: zodResolver(couponSchema),
    defaultValues: coupon ?? {
      code: '',
      type: 'percentage',
      value: 10,
      minimum: 0,
      usageLimit: 100,
      active: true,
      expiresAt: null,
    },
  });
  const type = watch('type');
  return (
    <Dialog
      open
      title={coupon ? 'Edit discount' : 'Create discount'}
      description="Set a clear offer and let the right pieces find their people."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="admin-form"
        onSubmit={handleSubmit(async (data) => {
          try {
            await save({ id: coupon?.id, data }).unwrap();
            toast.success('Discount saved');
            onClose();
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        })}
        noValidate
      >
        <div className="admin-form-grid">
          <Field label="Discount code" error={errors.code?.message}>
            <Input
              {...register('code')}
              placeholder="WELCOME10"
              style={{ textTransform: 'uppercase' }}
            />
          </Field>
          <Field label="Discount type" error={errors.type?.message}>
            <Select
              {...register('type')}
              onChange={(event) => {
                const value = event.target.value as 'fixed' | 'percentage';
                setValue('type', value);
                setValue('value', value === 'fixed' ? 1000 : 10);
              }}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </Select>
          </Field>
          <Controller
            name="value"
            control={control}
            render={({ field }) => (
              <Field
                label={type === 'percentage' ? 'Percentage off' : 'Discount amount (USD)'}
                error={errors.value?.message}
              >
                <Input
                  type="number"
                  min={type === 'percentage' ? 1 : 0.01}
                  max={type === 'percentage' ? 100 : undefined}
                  step={type === 'percentage' ? 1 : 0.01}
                  value={type === 'fixed' ? field.value / 100 : field.value}
                  onChange={(event) =>
                    field.onChange(
                      type === 'fixed'
                        ? Math.round(Number(event.target.value) * 100)
                        : Number(event.target.value),
                    )
                  }
                />
              </Field>
            )}
          />
          <Controller
            name="minimum"
            control={control}
            render={({ field }) => (
              <Field label="Minimum order (USD)" error={errors.minimum?.message}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={field.value / 100}
                  onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 100))}
                />
              </Field>
            )}
          />
          <Field label="Usage limit" error={errors.usageLimit?.message}>
            <Input
              type="number"
              min="1"
              step="1"
              {...register('usageLimit', { valueAsNumber: true })}
            />
          </Field>
          <Controller
            name="expiresAt"
            control={control}
            render={({ field }) => (
              <Field label="Expires on (end of day, UTC)" error={errors.expiresAt?.message}>
                <Input
                  type="date"
                  value={field.value?.slice(0, 10) ?? ''}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value ? `${event.target.value}T23:59:59.000Z` : null,
                    )
                  }
                />
              </Field>
            )}
          />
        </div>
        <label className="admin-checkbox">
          <input type="checkbox" {...register('active')} /> Discount is active
        </label>
        <div className="admin-form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save discount'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
