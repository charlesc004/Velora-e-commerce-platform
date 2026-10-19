import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, type Product, type ProductInput } from '@velora/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/utils/errors';
import { useSaveProductMutation, useTaxonomyQuery } from '../api/admin.api';

function newVariant() {
  const id = crypto.randomUUID();
  return {
    id,
    sku: `VEL-${id.slice(0, 6).toUpperCase()}`,
    size: 'M',
    color: 'Natural',
    colorHex: '#e6dfd0',
    stock: 0,
  };
}
const defaults: ProductInput = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  category: '',
  collection: '',
  gender: 'unisex',
  images: ['/images/shirt.jpg'],
  price: 10000,
  compareAtPrice: null,
  status: 'draft',
  tags: [],
  variants: [newVariant()],
};

export default function ProductEditor({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const [save, { isLoading }] = useSaveProductMutation();
  const { data: categories = [] } = useTaxonomyQuery('categories');
  const { data: collections = [] } = useTaxonomyQuery('collections');
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ?? { ...defaults, variants: [newVariant()] },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
    keyName: 'fieldKey',
  });
  const submit = handleSubmit(async (data) => {
    try {
      await save({ id: product?.id, data }).unwrap();
      toast.success(product ? 'Product updated' : 'Product created');
      onClose();
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={product ? 'Edit product' : 'Add a product'}
      description="The details make the difference. Give every piece a clear story."
    >
      <form className="admin-form" onSubmit={submit} noValidate>
        <div className="admin-form-grid">
          <Field label="Product name" error={errors.name?.message}>
            <Input
              {...register('name')}
              onBlur={(event) => {
                void register('name').onBlur(event);
                if (!getValues('slug'))
                  setValue(
                    'slug',
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  );
              }}
            />
          </Field>
          <Field label="URL slug" error={errors.slug?.message}>
            <Input {...register('slug')} />
          </Field>
          <Field label="SKU" error={errors.sku?.message}>
            <Input {...register('sku')} />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <Select {...register('status')}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Category" error={errors.category?.message}>
            <Select {...register('category')}>
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Collection" error={errors.collection?.message}>
            <Select {...register('collection')}>
              <option value="">Choose collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.slug}>
                  {collection.name}
                </option>
              ))}
            </Select>
          </Field>
          <Controller
            name="price"
            control={control}
            render={({ field }) => (
              <Field label="Price (USD)" error={errors.price?.message}>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={field.value / 100}
                  onChange={(event) => field.onChange(Math.round(Number(event.target.value) * 100))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Controller
            name="compareAtPrice"
            control={control}
            render={({ field }) => (
              <Field
                label="Compare at price (USD, optional)"
                error={errors.compareAtPrice?.message}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={field.value === null ? '' : field.value / 100}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ''
                        ? null
                        : Math.round(Number(event.target.value) * 100),
                    )
                  }
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Field label="Designed for" error={errors.gender?.message}>
            <Select {...register('gender')}>
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="unisex">Everyone</option>
            </Select>
          </Field>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <Field label="Tags (comma separated)" error={errors.tags?.message}>
                <Input
                  value={field.value.join(', ')}
                  onChange={(event) =>
                    field.onChange(event.target.value.split(',').map((tag) => tag.trim()))
                  }
                  onBlur={field.onBlur}
                />
              </Field>
            )}
          />
          <div className="span-two">
            <Field label="Description" error={errors.description?.message}>
              <Textarea rows={4} {...register('description')} />
            </Field>
          </div>
          <div className="span-two">
            <Controller
              name="images"
              control={control}
              render={({ field }) => (
                <Field
                  label="Image paths or HTTPS URLs (one per line)"
                  error={errors.images?.message ?? errors.images?.[0]?.message}
                >
                  <Textarea
                    rows={3}
                    value={field.value.join('\n')}
                    onChange={(event) => field.onChange(event.target.value.split('\n'))}
                    onBlur={field.onBlur}
                  />
                </Field>
              )}
            />
          </div>
        </div>
        <div className="admin-form-section">
          <h3>Product variants</h3>
          {fields.map((variant, index) => (
            <div className="admin-variant" key={variant.fieldKey}>
              <div className="admin-variant-header">
                <strong>Variant {index + 1}</strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length === 1}
                  aria-label={`Remove variant ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <div className="admin-form-grid">
                <Field label="Variant SKU" error={errors.variants?.[index]?.sku?.message}>
                  <Input {...register(`variants.${index}.sku`)} />
                </Field>
                <Field label="Size" error={errors.variants?.[index]?.size?.message}>
                  <Input {...register(`variants.${index}.size`)} />
                </Field>
                <Field label="Color name" error={errors.variants?.[index]?.color?.message}>
                  <Input {...register(`variants.${index}.color`)} />
                </Field>
                <Field label="Color" error={errors.variants?.[index]?.colorHex?.message}>
                  <Input type="color" {...register(`variants.${index}.colorHex`)} />
                </Field>
                <Field
                  label={
                    product?.variants.some((existing) => existing.id === variant.id)
                      ? 'Stock (adjust in Inventory)'
                      : 'Units in stock'
                  }
                  error={errors.variants?.[index]?.stock?.message}
                >
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    readOnly={product?.variants.some((existing) => existing.id === variant.id)}
                    {...register(`variants.${index}.stock`, { valueAsNumber: true })}
                  />
                </Field>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append(newVariant())}
            disabled={fields.length >= 60}
          >
            <Plus size={14} /> Add variant
          </Button>
          {errors.variants?.message && (
            <p className="admin-form-error">{errors.variants.message}</p>
          )}
        </div>
        <div className="admin-form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
