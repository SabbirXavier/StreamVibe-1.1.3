import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = true }: GlassCardProps) {
  return (
    <div className={cn(
      "glass-panel rounded-3xl p-6",
      hover && "glass-card-hover",
      className
    )}>
      {children}
    </div>
  );
}
