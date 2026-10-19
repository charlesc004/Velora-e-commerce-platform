import { useEffect } from 'react';
import type { PreviewInput, Totals } from '@velora/contracts';
import { usePreviewMutation } from '../api/checkout.api';
export function useCheckoutPreview(input: PreviewInput): {
  totals?: Totals;
  loading: boolean;
  error: unknown;
} {
  const [preview, result] = usePreviewMutation();
  const serialized = JSON.stringify(input);
  useEffect(() => {
    const parsed = JSON.parse(serialized) as PreviewInput;
    if (!parsed.items.length) return;
    const request = preview(parsed);
    return () => request.abort();
  }, [serialized, preview]);
  return { totals: result.data, loading: result.isLoading, error: result.error };
}
