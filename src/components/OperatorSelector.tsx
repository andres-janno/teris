import React from 'react';
import { Users, ChevronDown } from 'lucide-react';
import type { RelatedParty } from '../types/party';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator } from './ui';

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
    <div className="header-operator">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="filter"
            size="auto"
            className="header-operator-trigger"
            aria-label={`Operaator: ${label}`}
            title={selected.length ? selectedNames.join(', ') : 'Filtreeri kaarti ja statistikat operaatori (harija) järgi'}
          >
            <Users size={15} />
            <span className="header-operator-text">
              <span className="header-operator-caption">Operaator</span>
              <span className="header-operator-value">{label}</span>
            </span>
            {selected.length > 0 && <span className="header-operator-dot" />}
            <ChevronDown size={15} className="header-operator-chevron" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="header-operator-content">
          {/* Valik ei sulge menüüd: mitu operaatorit saab märkida järjest. */}
          <DropdownMenuCheckboxItem
            checked={selected.length === 0}
            onCheckedChange={() => onChange([])}
            onSelect={(e) => e.preventDefault()}
          >
            <span>Kõik operaatorid</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {operators.length === 0 && <div className="header-operator-empty">Operaatoreid pole (seotud isikute registris roll „Operaator“)</div>}
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
