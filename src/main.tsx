import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import { AuthGate } from './AuthGate.tsx'
import { TooltipProvider } from './components/ui/Popover'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <AuthGate />
    </TooltipProvider>
  </StrictMode>,
)
