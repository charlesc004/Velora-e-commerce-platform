import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <ArrowUpRight size={32} strokeWidth={1} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
