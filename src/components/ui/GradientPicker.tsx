import React from 'react';
import { cn } from '../../lib/utils';

interface GradientPickerProps {
  value: string;
  onChange: (gradient: string) => void;
  label?: string;
}

const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)', // Sunset
  'linear-gradient(135deg, #13f1fc 0%, #0470dc 100%)', // Ocean
  'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)', // Deep Purple
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', // Emerald
  'linear-gradient(135deg, #f7ff00 0%, #db36a4 100%)', // Sunset Flare
  'linear-gradient(135deg, #000428 0%, #004e92 100%)', // Midnight
];

export function GradientPicker({ value, onChange, label }: GradientPickerProps) {
  return (
    <div className="space-y-2">
      {label && <label className="text-xs font-bold uppercase text-neutral-500">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        {PRESET_GRADIENTS.map((gradient, idx) => (
          <button
            key={idx}
            onClick={() => onChange(gradient)}
            className={cn(
              "w-full h-10 rounded-xl border-2 transition-all",
              value === gradient ? "border-white shadow-lg scale-105" : "border-transparent"
            )}
            style={{ background: gradient }}
            title={`Select gradient ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
