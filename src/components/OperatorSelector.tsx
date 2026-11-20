import React from 'react';
import { Users, ChevronDown } from 'lucide-react';
import type { RelatedParty } from '../types/party';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator, cn } from './ui';
import { headerChevronClass, headerNarrowHiddenClass, headerTriggerClass } from './ui/variants';

interface OperatorSelectorProps {
  parties: RelatedParty[];
  selected: string[]; // tühi = kõik operaatorid
  onChange: (ids: string[]) => void;
}

// Operaatori (harija) filter päises logo kõrval — valik kehtib kaardile, statistikale ja registritele.
export const OperatorSelector: React.FC<OperatorSelectorProps> = ({ parties, selected, onChange }) => {
  // Operaatori rolliga isikud + juba valitud (kui roll on vahepeal eemaldatud).
  const operators = parties.filter((p) => p.roles?.includes('OPERATOR') || selected.includes(p.id));
  const selectedNames = operators.filter((p) => selected.includes(p.id)).map((p) => p.name);
  const label =
    selected.length === 0
      ? 'Kõik operaatorid'
      : selected.length === 1
        ? selectedNames[0] ?? '1 operaator'
        : `${selected.length} operaatorit`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="ml-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="filter"
            size="auto"
            className={headerTriggerClass}
            aria-label={`Operaator: ${label}`}
            title={selected.length ? selectedNames.join(', ') : 'Filtreeri kaarti ja statistikat operaatori (harija) järgi'}
          >
            <Users size={15} />
            <span className={cn('flex flex-col items-start', headerNarrowHiddenClass)}>
              <span className="text-2xs leading-3 font-semibold tracking-widest uppercase opacity-70">Operaator</span>
              <span className="max-w-45 truncate text-base leading-4 font-medium">{label}</span>
            </span>
            {selected.length > 0 && <span className="size-1.75 rounded-full bg-warning-solid text-warning-solid shadow-glow max-[1655px]:absolute max-[1655px]:top-1 max-[1655px]:right-1 max-[1655px]:size-1.5" />}
            <ChevronDown size={15} className={cn('opacity-80', headerChevronClass)} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-60">
          {/* Valik ei sulge menüüd: mitu operaatorit saab märkida järjest. */}
          <DropdownMenuCheckboxItem
            checked={selected.length === 0}
            onCheckedChange={() => onChange([])}
            onSelect={(e) => e.preventDefault()}
          >
            <span>Kõik operaatorid</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {operators.length === 0 && <div className="px-2.5 py-2 text-sm text-muted-foreground">Operaatoreid pole (seotud isikute registris roll „Operaator“)</div>}
          {operators.map((p) => (
            <DropdownMenuCheckboxItem
              key={p.id}
              checked={selected.includes(p.id)}
              onCheckedChange={() => toggle(p.id)}
              onSelect={(e) => e.preventDefault()}
            >
              <span>{p.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
