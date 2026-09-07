import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/auth-provider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/** Un único proveedor por pestaña cubre todas las pantallas de la SPA. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
