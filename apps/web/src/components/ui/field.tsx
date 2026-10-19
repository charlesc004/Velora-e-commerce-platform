import { useId, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}): React.JSX.Element {
  const id = useId();
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': error ? `${id}-error` : undefined,
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {child}
      {error && (
        <span role="alert" className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
