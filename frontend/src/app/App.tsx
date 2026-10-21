import { BrowserRouter } from 'react-router'
import { AppProviders } from './providers'
import { AppRoutes } from './router'

export default function App() {
  return <AppProviders><BrowserRouter><AppRoutes /></BrowserRouter></AppProviders>
}
