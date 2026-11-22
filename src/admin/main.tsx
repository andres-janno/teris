import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/app.css';
import { AdminApp } from './AdminApp.tsx';
import { TooltipProvider } from '../components/ui/Popover';

// Põhirakendus keelab lehe kerimise (body overflow: hidden, base.css); admin on tavaline kerivate lehtedega leht.
document.body.classList.add('overflow-auto');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <AdminApp />
    </TooltipProvider>
  </StrictMode>
);
