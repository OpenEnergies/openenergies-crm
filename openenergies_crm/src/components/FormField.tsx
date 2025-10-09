import { ReactNode } from 'react';

export function FormField({ label, htmlFor, children, hint }:{
  label: string; htmlFor: string; children: ReactNode; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <div aria-live="polite" style={{fontSize:'.8rem', color:'#64748B', marginTop:'.25rem'}}>{hint}</div> : null}
    </div>
  );
}
