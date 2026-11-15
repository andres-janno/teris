import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/app.css';
import './admin.css';
import { AdminApp } from './AdminApp.tsx';
import { TooltipProvider } from '../components/ui/Popover';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <AdminApp />
    </TooltipProvider>
  </StrictMode>
);
