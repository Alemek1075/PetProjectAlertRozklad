import '@/lib/theme'
import '@/styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/components/app/AppProviders'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders tooltipDelay={500}>
      <App />
    </AppProviders>
  </StrictMode>,
)
