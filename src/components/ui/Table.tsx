// src/components/ui/Table.tsx — ühine tabel. Numbriveerg (numeric) joondub paremale; koguste vormindus
// (formatQty, 2 komakohta) jääb kutsuja teha.
import React from 'react';
import { cn } from './cn';

export const Table: React.FC<React.ComponentProps<'table'>> = ({ className, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full border-collapse text-xs', className)} {...props} />
  </div>
);

export const TableHeader: React.FC<React.ComponentProps<'thead'>> = (props) => <thead {...props} />;
export const TableBody: React.FC<React.ComponentProps<'tbody'>> = (props) => <tbody {...props} />;
export const TableFooter: React.FC<React.ComponentProps<'tfoot'>> = ({ className, ...props }) => (
  <tfoot className={cn('bg-muted font-semibold', className)} {...props} />
);

export const TableRow: React.FC<React.ComponentProps<'tr'> & { selected?: boolean }> = ({ className, selected, ...props }) => (
  <tr
    data-selected={selected || undefined}
    className={cn('border-b border-border transition-colors hover:bg-muted data-[selected]:bg-primary/10', className)}
    {...props}
  />
);

export const TableHead: React.FC<React.ComponentProps<'th'> & { numeric?: boolean }> = ({ className, numeric, ...props }) => (
  <th
    className={cn(
      'whitespace-nowrap px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground',
      numeric && 'text-right',
      className
    )}
    {...props}
  />
);

export const TableCell: React.FC<React.ComponentProps<'td'> & { numeric?: boolean }> = ({ className, numeric, ...props }) => (
  <td className={cn('px-2.5 py-1.5 align-middle', numeric && 'text-right tabular-nums', className)} {...props} />
);
