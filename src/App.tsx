import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/error-boundary'
import { I18nProvider } from '@/i18n'
import { queryClient } from '@/lib/query-client'
import { ThemeProvider } from '@/themes'

import DesktopController from './app/index'
import HeroDemoView from './app/hero-demo'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <HashRouter>
            <ErrorBoundary>
              <Routes>
                <Route element={<HeroDemoView />} path="/hero-demo" />
                <Route element={<DesktopController />} path="*" />
              </Routes>
            </ErrorBoundary>
          </HashRouter>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
