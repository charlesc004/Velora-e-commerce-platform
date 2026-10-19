import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taxonomySchema, type Category } from '@velora/contracts';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { errorMessage } from '@/lib/utils/errors';
import {
  useTaxonomyQuery,
  useSaveTaxonomyMutation,
  useDeleteTaxonomyMutation,
  type TaxonomyInput,
} from '../api/admin.api';

type Kind = 'categories' | 'collections';
export default function TaxonomyPage({ kind }: { kind: Kind }) {
  const { data, isLoading, error, refetch } = useTaxonomyQuery(kind);
  const [editor, setEditor] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [remove, { isLoading: removing }] = useDeleteTaxonomyMutation();
  const singular = kind === 'categories' ? 'category' : 'collection';
  return (
    <>
      <PageHeader
        title={kind === 'categories' ? 'Categories' : 'Collections'}
        description={
          kind === 'categories'
            ? 'Give every piece a place in your catalog.'
            : 'Curate stories that bring your products together.'
        }
      >
        <Button size="sm" onClick={() => setEditor('new')}>
          <Plus size={15} /> Add {singular}
        </Button>
      </PageHeader>
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <ErrorState error={error} retry={refetch} />
      ) : !data?.length ? (
        <EmptyState
          title={`Create your first ${singular}`}
          description={`Organize your catalog with a thoughtful ${singular}.`}
        >
          <Button onClick={() => setEditor('new')}>Add {singular}</Button>
        </EmptyState>
      ) : (
        <div className="admin-taxonomy-grid">
          {data.map((item) => (
            <article className="admin-panel admin-taxonomy-card" key={item.id}>
              <img src={item.image} alt="" loading="lazy" />
              <div className="admin-taxonomy-body">
                <h2>{item.name}</h2>
                <p>{item.description || 'A considered selection from the Velora collection.'}</p>
                <span className="admin-inline-code">/{item.slug}</span>
                <div className="admin-actions">
                  <Button variant="outline" size="sm" onClick={() => setEditor(item)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <TaxonomyEditor
          kind={kind}
          item={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Dialog
          open
          title={`Delete ${deleting.name}?`}
          description={`A ${singular} can be deleted when it is no longer assigned to any products.`}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
        >
          <div className="admin-form-footer">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep {singular}
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={async () => {
                try {
                  await remove({ kind, id: deleting.id }).unwrap();
                  toast.success(`${singular[0].toUpperCase() + singular.slice(1)} deleted`);
                  setDeleting(null);
                } catch (cause) {
                  toast.error(errorMessage(cause));
                }
              }}
            >
              {removing ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function TaxonomyEditor({
  kind,
  item,
  onClose,
}: {
  kind: Kind;
  item?: Category;
  onClose: () => void;
}) {
  const [save, { isLoading }] = useSaveTaxonomyMutation();
  const {
    register,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<TaxonomyInput>({
    resolver: zodResolver(taxonomySchema),
    defaultValues: item ?? { name: '', slug: '', image: '/images/editorial.jpg', description: '' },
  });
  const singular = kind === 'categories' ? 'category' : 'collection';
  return (
    <Dialog
      open
      title={`${item ? 'Edit' : 'Add'} ${singular}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <form
        className="admin-form"
        onSubmit={handleSubmit(async (data) => {
          try {
            await save({ kind, id: item?.id, data }).unwrap();
            toast.success(`${singular[0].toUpperCase() + singular.slice(1)} saved`);
            onClose();
          } catch (cause) {
            toast.error(errorMessage(cause));
          }
        })}
        noValidate
      >
        <Field label="Name" error={errors.name?.message}>
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
        <Field label="Image path or HTTPS URL" error={errors.image?.message}>
          <Input {...register('image')} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <Textarea rows={4} {...register('description')} />
        </Field>
        <div className="admin-form-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isLoading} type="submit">
            {isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
