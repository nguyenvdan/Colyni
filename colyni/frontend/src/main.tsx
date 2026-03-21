import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { applyInviteSearchParams } from '@/lib/invite-link'
import { ThemeProvider } from './lib/theme.tsx'
import App from './App.tsx'
import './index.css'

applyInviteSearchParams()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
