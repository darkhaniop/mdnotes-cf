import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { router } from '@/router';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { useApplyTheme } from '@/hooks/useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export function App() {
  // Mounted here rather than in AppLayout so the landing and auth screens are
  // themed too.
  const resolvedTheme = useApplyTheme();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster richColors position="bottom-right" closeButton theme={resolvedTheme} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
