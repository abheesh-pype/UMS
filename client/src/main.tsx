import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/hooks/useAuth'
import { OperationButtonGuard } from '@/components/OperationButtonGuard'
import { installFetchOperationTracking } from '@/lib/operationTracker'

installFetchOperationTracking()

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
    <OperationButtonGuard />
    <Toaster position="top-right" richColors />
  </AuthProvider>,
)
