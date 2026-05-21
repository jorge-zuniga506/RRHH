import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { AssistantPage } from '../pages/AssistantPage';
import { PulsePage } from '../pages/PulsePage';
import { EnpsPage } from '../pages/EnpsPage';
import { Layout } from '../components/Layout';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Layout>
        <Outlet />
      </Layout>
    ),
    children: [
      {
        index: true,
        element: <AssistantPage />,
      },
      {
        path: 'pulse',
        element: <PulsePage />,
      },
      {
        path: 'enps',
        element: <EnpsPage />,
      },
    ],
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
