// src/components/DeferredMount.tsx — laisalt laaditud komponent mountitakse alles esimesel avamisel
// (siis laaditakse ka selle kood) ja jäetakse seejärel alles, et sulgemine/avamine käituks nagu varem.
import React, { Suspense, useState } from 'react';

export const DeferredMount: React.FC<{ when: boolean; children: React.ReactNode }> = ({ when, children }) => {
  const [mounted, setMounted] = useState(when);
  if (when && !mounted) setMounted(true);
  return mounted ? <Suspense fallback={null}>{children}</Suspense> : null;
};
