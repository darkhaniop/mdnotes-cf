import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Landing } from '@/routes/Landing';
import { Login } from '@/routes/Login';
import { Signup } from '@/routes/Signup';
import { NotFound, RouteErrorBoundary } from '@/routes/NotFound';

export const router = createBrowserRouter([
  { path: '/', element: <Landing />, errorElement: <RouteErrorBoundary /> },
  { path: '/login', element: <Login />, errorElement: <RouteErrorBoundary /> },
  { path: '/signup', element: <Signup />, errorElement: <RouteErrorBoundary /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [{ path: '/projects', element: <div /> }],
  },
  { path: '*', element: <NotFound /> },
]);
