// src/components/ui/PageHeader.tsx — vaate päis: ikoon, pealkiri (h2), alapealkiri ja tegevused (nupud, filtrid) paremas servas.
import React from 'react';
import { cn } from './cn';
import {
  pageHeaderActionsClass, pageHeaderClass, pageHeaderIconClass, pageHeaderSubtitleClass, pageHeaderTitleClass, pageHeaderTitleWrapClass,
} from './variants';

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ icon, title, subtitle, actions, className }) => (
  <div className={cn(pageHeaderClass, className)}>
    <div className={pageHeaderTitleWrapClass}>
      <span className={pageHeaderIconClass} aria-hidden="true">{icon}</span>
      <div>
        <h2 className={pageHeaderTitleClass}>{title}</h2>
        {subtitle != null && <div className={pageHeaderSubtitleClass}>{subtitle}</div>}
      </div>
    </div>
    {actions != null && <div className={pageHeaderActionsClass}>{actions}</div>}
  </div>
);
