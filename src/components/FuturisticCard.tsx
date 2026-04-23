import React from 'react';
import { cn } from '../lib/utils';

interface FuturisticCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function FuturisticCard({ children, className, onClick }: FuturisticCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "glass-panel rounded-[2.5rem] p-8",
        "bg-neutral-100/50 dark:bg-neutral-900/50",
        "border border-neutral-200 dark:border-white/10",
        "transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  );
}
