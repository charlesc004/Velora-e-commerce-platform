export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('data' in error) {
      const data = error.data as { error?: { message?: string } } | undefined;
      if (data?.error?.message) return data.error.message;
    }
    if ('message' in error && typeof error.message === 'string') return error.message;
    if ('status' in error && error.status === 'FETCH_ERROR')
      return 'We could not reach VELORA. Please check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
