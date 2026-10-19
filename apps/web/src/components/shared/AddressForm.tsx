import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { Address } from '@velora/contracts';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
export interface CustomerDetails {
  email: string;
  address: Address;
}
export function AddressForm({
  register,
  errors,
  includeEmail = true,
}: {
  register: UseFormRegister<CustomerDetails>;
  errors: FieldErrors<CustomerDetails>;
  includeEmail?: boolean;
}): React.JSX.Element {
  return (
    <div className="form-stack">
      {includeEmail && (
        <Field label="Email address" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
      )}
      <Field label="Full name" error={errors.address?.name?.message}>
        <Input autoComplete="name" {...register('address.name')} />
      </Field>
      <Field label="Street address" error={errors.address?.line1?.message}>
        <Input autoComplete="address-line1" {...register('address.line1')} />
      </Field>
      <Field label="Apartment, suite, etc. (optional)" error={errors.address?.line2?.message}>
        <Input autoComplete="address-line2" {...register('address.line2')} />
      </Field>
      <div className="form-grid">
        <Field label="City" error={errors.address?.city?.message}>
          <Input autoComplete="address-level2" {...register('address.city')} />
        </Field>
        <Field label="State / region" error={errors.address?.region?.message}>
          <Input autoComplete="address-level1" {...register('address.region')} />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="ZIP / postal code" error={errors.address?.postalCode?.message}>
          <Input autoComplete="postal-code" {...register('address.postalCode')} />
        </Field>
        <Field label="Country" error={errors.address?.country?.message}>
          <Select autoComplete="country" {...register('address.country')}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="AU">Australia</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}
