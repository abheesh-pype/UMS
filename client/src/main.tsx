import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/hooks/useAuth'
import { OperationButtonGuard } from '@/components/OperationButtonGuard'
import { installFetchOperationTracking } from '@/lib/operationTracker'
import { installDataUrlLinkHandler } from '@/lib/fileUrl'

installFetchOperationTracking()
installDataUrlLinkHandler()

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
    <OperationButtonGuard />
    <Toaster
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      toastOptions={{
        duration: 4500,
        style: {
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.16)',
        },
      }}
    />
  </AuthProvider>,
)
