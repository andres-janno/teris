// src/components/ui/SearchInput.tsx — otsinguväli: luubi ikoon, X tühjendab (asendab .search-box-wrap + .search-input).
import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';
import { FilterClear } from './FilterClear';
import type { FieldSize } from './variants';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  'aria-label': string;
  size?: FieldSize;
  className?: string;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, className, size, ...props }) => (
  <FilterClear active={value !== ''} onClear={() => onChange('')} className={className}>
    <Input
      type="text"
      inputMode="search"
      enterKeyHint="search"
      size={size}
      start={<Search size={14} />}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  </FilterClear>
);
