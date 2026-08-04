import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { Landing } from '@/routes/Landing';
import { Login } from '@/routes/Login';
import { Signup } from '@/routes/Signup';
import { ProjectList } from '@/routes/ProjectList';
import { ProjectDetail } from '@/routes/ProjectDetail';
import { DocumentView } from '@/routes/DocumentView';
import { DocumentEdit } from '@/routes/DocumentEdit';
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
    children: [
      { path: '/projects', element: <ProjectList /> },
      { path: '/projects/:projectId', element: <ProjectDetail /> },
      { path: '/projects/:projectId/docs/:docId', element: <DocumentView /> },
      { path: '/projects/:projectId/docs/:docId/edit', element: <DocumentEdit /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
