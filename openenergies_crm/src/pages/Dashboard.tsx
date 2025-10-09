import { useSession } from '@hooks/useSession';

export default function Dashboard(){
  const { rol } = useSession();
  return (
    <div className="grid">
      <div className="card">
        <h2 style={{marginTop:0}}>Bienvenido</h2>
        <p>Este es tu panel. Tu rol es <span className="badge">{rol ?? '—'}</span>.</p>
        <ul>
          <li>Los menús se adaptan a tu rol.</li>
          <li>Los datos están protegidos por <strong>RLS</strong> en la base de datos.</li>
        </ul>
      </div>
    </div>
  );
}
