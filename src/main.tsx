import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles.css'

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      networkMode: 'always',
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      gcTime: 300_000,
    },
  },
})
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
)
