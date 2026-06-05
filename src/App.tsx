import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { HashRouter } from 'react-router-dom'

import { ErrorBoundary } from '@/components/error-boundary'

import DesktopController from './app/index'

export default function App() {
  const [queryClient] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ErrorBoundary>
          <DesktopController />
        </ErrorBoundary>
      </HashRouter>
    </QueryClientProvider>
  )
}
