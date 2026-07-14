import { initSentry, Sentry } from './utils/sentry'
// Must run before createRoot so Sentry is active before the React tree renders.
// Safe no-op when VITE_SENTRY_DSN is absent (local dev, CI, tests).
initSentry()

import {createRoot} from 'react-dom/client'
import{BrowserRouter} from 'react-router-dom'
import App from './App'
import './index.css'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import AppCrashFallback from './components/AppCrashFallback'

createRoot(
  document.getElementById('root')
).render(
  // ErrorBoundary wraps the whole tree so any unhandled render crash shows a
  // friendly fallback instead of a white screen.  When Sentry is initialised
  // it also reports the error; when it isn't (no DSN) it acts as a plain
  // React error boundary with no network side-effects.
  <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
    <BrowserRouter>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <App/>
    </LocalizationProvider>
    </BrowserRouter>
  </Sentry.ErrorBoundary>
)
