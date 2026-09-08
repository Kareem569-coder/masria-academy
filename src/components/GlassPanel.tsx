import type { HTMLAttributes } from 'react';

export default function GlassPanel({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass-panel ${className}`.trim()} {...props} />;
}
