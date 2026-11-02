import '@/lib/theme'
import '@/styles/globals.css'
import './editor.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/components/app/AppProviders'
import { AppToaster } from '@/components/app/AppToaster'
import { EditorApp } from './Editor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders tooltipDelay={700}>
      <EditorApp />
      <AppToaster />
    </AppProviders>
  </StrictMode>,
)
