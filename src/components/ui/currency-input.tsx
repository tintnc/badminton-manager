import React, { useState } from 'react';
import { Input } from './input';
import { formatNumber } from '@/lib/format';

function formatInputNumber(n: number): string {
  if (n === 0) return '';
  return formatNumber(n);
}

export function CurrencyInput({
  id,
  name,
  value,
  onChange,
  placeholder = '0',
  disabled = false,
}: {
  id?: string;
  name?: string;
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState('');

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setDraftValue(value === 0 ? '' : formatInputNumber(value));
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(raw);
    setDraftValue(raw === '' ? '' : formatNumber(num));
    onChange(num);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <Input
      id={id}
      name={name ?? id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={isFocused ? draftValue : formatInputNumber(value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

// Simple integer input (for shuttlecocks used count)
export function IntegerInput({
  id,
  name,
  value,
  onChange,
  min = 0,
  placeholder = '0',
  disabled = false,
}: {
  id?: string;
  name?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState('');

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setDraftValue(value === 0 ? '' : String(value));
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setDraftValue(raw);
    onChange(Number(raw) || 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <Input
      id={id}
      name={name ?? id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={isFocused ? draftValue : (value === 0 ? '' : String(value))}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
    />
  );
}
