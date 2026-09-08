import type { HTMLAttributes } from 'react';

export default function GlassCard({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass-panel rounded-2xl ${className}`.trim()} {...props} />;
}
