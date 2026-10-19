import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from './store';
export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <Provider store={store}>
      {children}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 0 } }}
      />
    </Provider>
  );
}
