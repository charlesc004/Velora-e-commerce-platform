import { Badge } from '@/components/ui/badge';

const colors: Record<string, { color: string; background: string }> = {
  published: { color: '#5c7f58', background: '#eef4e9' },
  paid: { color: '#5c7f58', background: '#eef4e9' },
  delivered: { color: '#5c7f58', background: '#eef4e9' },
  processing: { color: '#8b784e', background: '#faf4e5' },
  shipped: { color: '#5c8091', background: '#edf4f7' },
  draft: { color: '#8c8f83', background: '#f1f2ee' },
  archived: { color: '#8c8f83', background: '#f1f2ee' },
  pending: { color: '#aa8b58', background: '#faf5e7' },
  cancelled: { color: '#a66d61', background: '#fbefeb' },
  expired: { color: '#a66d61', background: '#fbefeb' },
  failed: { color: '#a66d61', background: '#fbefeb' },
  refunded: { color: '#8b7898', background: '#f3eef6' },
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      style={{
        ...colors[status],
        fontSize: 9,
        fontWeight: 500,
        textTransform: 'capitalize',
        border: 0,
      }}
    >
      {status}
    </Badge>
  );
}
