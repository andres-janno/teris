// src/components/ui/Table.tsx — ühine tabel (etapp 2.3). Päis kleepub alati; numbriveerg paremale; kogused vormindab
// kutsuja (formatQty). <table> kannab data-slot="table" (tabeli sisu stiili hoiavad ui/variants.ts konstandid).
import React, { createContext, useContext } from 'react';
import { cn } from './cn';
import { clickOnActivationKey } from './keyActivation';
import {
  tableCellClass, tableClass, tableContainerClass, tableFooterClass, tableHeadClass, tableRowClass,
  type TablePin, type TableRowTone, type TableScroll,
} from './variants';

const TableDensity = createContext(false);

type TableProps = React.ComponentProps<'table'> & {
  scroll?: TableScroll;
  bordered?: boolean;
  dense?: boolean;
  containerClassName?: string;
};

export const Table: React.FC<TableProps> = ({ className, containerClassName, scroll = 'x', bordered = false, dense = false, ...props }) => (
  <TableDensity.Provider value={dense}>
    <div className={cn(tableContainerClass({ scroll, bordered }), containerClassName)}>
      <table data-slot="table" className={cn(tableClass({ bordered }), className)} {...props} />
    </div>
  </TableDensity.Provider>
);

// Päiserea hover on välja lülitatud (TableRow hover on mõeldud andmeridadele).
export const TableHeader: React.FC<React.ComponentProps<'thead'>> = ({ className, ...props }) => (
  <thead className={cn('[&_tr]:hover:bg-transparent', className)} {...props} />
);
export const TableBody: React.FC<React.ComponentProps<'tbody'>> = (props) => <tbody {...props} />;
export const TableFooter: React.FC<React.ComponentProps<'tfoot'> & { sticky?: boolean }> = ({ className, sticky, ...props }) => (
  <tfoot className={cn(tableFooterClass({ sticky }), className)} {...props} />
);

/** Klõpsatav rida (onClick): Tab-fookus ja Enter/tühik käivitab sama klõpsu. */
export const TableRow: React.FC<React.ComponentProps<'tr'> & { selected?: boolean; tone?: TableRowTone }> = ({
  className, selected, tone, onClick, onKeyDown, tabIndex, ...props
}) => {
  const clickable = !!onClick;
  return (
    <tr
      data-selected={selected || undefined}
      onClick={onClick}
      tabIndex={clickable ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={clickable ? (e) => { onKeyDown?.(e); clickOnActivationKey(e); } : onKeyDown}
      className={cn(tableRowClass({ tone, clickable }), className)}
      {...props}
    />
  );
};

const ARIA_SORT = { asc: 'ascending', desc: 'descending', none: 'none' } as const;

export const TableHead: React.FC<
  React.ComponentProps<'th'> & { numeric?: boolean; pin?: TablePin; actions?: boolean; sort?: 'asc' | 'desc' | 'none' }
> = ({ className, numeric, pin, actions, sort, ...props }) => {
  const dense = useContext(TableDensity);
  return (
    <th
      aria-sort={sort ? ARIA_SORT[sort] : undefined}
      className={cn(tableHeadClass({ numeric, pin: actions ? 'end' : pin, sortable: !!sort, dense }), className)}
      {...props}
    />
  );
};

export const TableCell: React.FC<React.ComponentProps<'td'> & { numeric?: boolean; wrap?: boolean; pin?: TablePin; actions?: boolean }> = ({
  className, numeric, wrap, pin, actions, children, ...props
}) => {
  const dense = useContext(TableDensity);
  return (
    <td className={cn(tableCellClass({ numeric, wrap, pin: actions ? 'end' : pin, dense }), className)} {...props}>
      {actions ? <div className="flex items-center justify-center gap-0.5">{children}</div> : children}
    </td>
  );
};

/** Tühja tabeli rida: colSpan = veergude arv. */
export const TableEmpty: React.FC<{ colSpan: number; children: React.ReactNode }> = ({ colSpan, children }) => {
  const dense = useContext(TableDensity);
  return (
    <tr>
      <td colSpan={colSpan} className={cn(tableCellClass({ wrap: true, dense }), 'py-6 text-center text-subtle')}>{children}</td>
    </tr>
  );
};
