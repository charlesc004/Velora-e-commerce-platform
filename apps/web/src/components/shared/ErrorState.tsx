import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/utils/errors';
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}): React.JSX.Element {
  return (
    <div className="error-state" role="alert">
      <h2>We couldn’t load this just yet.</h2>
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
