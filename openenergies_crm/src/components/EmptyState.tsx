export function EmptyState({ title, description, cta }: { title: string; description: string; cta?: React.ReactNode }) {
  return (
    <div className="card" role="status" aria-live="polite" style={{textAlign:'center'}}>
      <h3 style={{margin:'0 0 .5rem'}}>{title}</h3>
      <p style={{color:'var(--muted)', margin:'0 0 1rem'}}>{description}</p>
      {cta}
    </div>
  );
}
