import React from 'react';

interface CyberToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CyberToggle({ id, checked, onChange }: CyberToggleProps) {
  return (
    <div className="cyber-toggle-wrapper">
      <input 
        className="cyber-toggle-checkbox" 
        id={id} 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="cyber-toggle" htmlFor={id}>
        <div className="cyber-toggle-track">
          <div className="cyber-toggle-track-glow"></div>
        </div>
        <div className="cyber-toggle-thumb">
          <div className="cyber-toggle-thumb-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M16.5 12c0-2.48-2.02-4.5-4.5-4.5s-4.5 2.02-4.5 4.5 2.02 4.5 4.5 4.5 4.5-2.02 4.5-4.5zm-4.5 7.5c-4.14 0-7.5-3.36-7.5-7.5s3.36-7.5 7.5-7.5 7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zm0-16.5c-4.97 0-9 4.03-9 9h-3l3.89 3.89.07.14 4.04-4.03h-3c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42c1.63 1.63 3.87 2.64 6.36 2.64 4.97 0 9-4.03 9-9s-4.03-9-9-9z"></path>
            </svg>
          </div>
        </div>
      </label>
      <div className="cyber-toggle-labels">
        <span className="cyber-toggle-label-off">Off</span>
        <span className="cyber-toggle-label-on">On</span>
      </div>
    </div>
  );
}
