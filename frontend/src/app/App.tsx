import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from './providers'
import { AppRoutes } from './router'

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }])

export default function App() {
  return <AppProviders><RouterProvider router={router} /></AppProviders>
}
