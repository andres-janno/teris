// src/components/ui/PageHeader.tsx — vaate päis: ikoon, pealkiri (h2), alapealkiri ja tegevused (nupud, filtrid) paremas servas.
import React from 'react';
import { cn } from './cn';
import { HelpHint } from './HelpHint';
import type { HelpKey } from '../../help/helpRegistry.ts';
import {
  pageHeaderActionsClass, pageHeaderClass, pageHeaderIconClass, pageHeaderSubtitleClass, pageHeaderTitleClass, pageHeaderTitleRowClass, pageHeaderTitleWrapClass,
} from './variants';

export const PageHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Vaate „?“-ikoon pealkirja kõrval (kohtjuhend `view.<vaade>`) */
  helpKey?: HelpKey;
}> = ({ icon, title, subtitle, actions, className, helpKey }) => (
  <div className={cn(pageHeaderClass, className)}>
    <div className={pageHeaderTitleWrapClass}>
      <span className={pageHeaderIconClass} aria-hidden="true">{icon}</span>
      <div>
        <div className={pageHeaderTitleRowClass}>
          <h2 className={pageHeaderTitleClass}>{title}</h2>
          {helpKey && <HelpHint helpKey={helpKey} />}
        </div>
        {subtitle != null && <div className={pageHeaderSubtitleClass}>{subtitle}</div>}
      </div>
    </div>
    {actions != null && <div className={pageHeaderActionsClass}>{actions}</div>}
  </div>
);
