import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase';
import { Link } from '@tanstack/react-router';
import type { UsuarioApp } from '@lib/types';
import { EmptyState } from '@components/EmptyState';

// Tipado extendido para incluir el nombre de la empresa
type UsuarioConEmpresa = UsuarioApp & { empresas: { nombre: string } | null };

async function fetchUsuarios() {
  const { data, error } = await supabase
    .from('usuarios_app')
    .select('*, empresas(nombre)')
    .order('creado_en', { ascending: false });

  if (error) throw error;
  return data as UsuarioConEmpresa[];
}

export default function UsuariosList() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios });

  return (
    <div className="grid">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Gestión de Usuarios</h2>
        <Link to="/app/usuarios/invitar"><button>Invitar Usuario</button></Link>
      </div>

      {isLoading && <div className="card">Cargando usuarios...</div>}
      {isError && <div className="card" role="alert">Error al cargar los usuarios.</div>}

      {data && data.length === 0 && (
        <EmptyState 
          title="No hay usuarios" 
          description="Invita al primer usuario para empezar a colaborar."
          cta={<Link to="/app/usuarios/invitar"><button>Invitar Usuario</button></Link>}
          //<Link to="/app/puntos/nuevo"><button>Nuevo</button></Link>
        />
      )}

      {data && data.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Empresa</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(u => (
                <tr key={u.user_id}>
                  <td>{u.nombre_completo ?? '—'}</td>
                  <td>{u.email ?? '—'}</td>
                  <td><span className="kbd">{u.rol}</span></td>
                  <td>{u.empresas?.nombre ?? '—'}</td>
                  <td>{u.activo ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}