// src/components/ui/NavSwitch.tsx — peamenüü: navigatsioonirida, kus praegune vaade on `current` (aria-current="page").
// Iga kirje on tavaline nupp (Tab, Enter, tühik). Paigutus (veerised, kerimine) on kasutaja klassis.
import React from 'react';
import { cn } from './cn';
import { navSwitchClass, navSwitchItemClass } from './variants';

export const NavSwitch: React.FC<React.ComponentProps<'nav'> & { 'aria-label': string }> = ({ className, ...props }) => (
  <nav data-slot="nav-switch" className={cn(navSwitchClass, className)} {...props} />
);

export const NavSwitchItem: React.FC<React.ComponentProps<'button'> & { current?: boolean }> = ({ className, current = false, type = 'button', ...props }) => (
  <button type={type} aria-current={current ? 'page' : undefined} className={cn(navSwitchItemClass, className)} {...props} />
);
