import { createRootRoute, createRoute, createRouter, Outlet, redirect, NotFoundRoute, Link } from '@tanstack/react-router';
import { useParams } from '@tanstack/react-router';
import Layout from '@components/Layout';
import Login from '@pages/auth/Login';
import Dashboard from '@pages/Dashboard';
import ClientesList from '@pages/clientes/ClientesList';
import ClienteForm from '@pages/clientes/ClienteForm';
import PuntosList from '@pages/puntos/PuntosList';
import PuntoForm from '@pages/puntos/PuntoForm';
import ContratosList from '@pages/contratos/ContratosList';
import ContratoForm from '@pages/contratos/ContratoForm';
import DocumentosPageWrapper from '@pages/documentos/DocumentosPageWrapper';
import ClienteDocumentosExplorer from '@pages/documentos/ClienteDocumentosExplorer'; 
import DocumentoUpload from '@pages/documentos/DocumentoUpload';
import UsuariosList from '@pages/usuarios/UsuariosList';
import UsuarioInviteForm from '@pages/usuarios/UsuarioInviteForm';
import EmpresasList from '@pages/empresas/EmpresasList';
import EmpresaForm from '@pages/empresas/EmpresaForm';
import EmpresasArchivadasPage from '@pages/empresas/EmpresasArchivadasPage'; 
import EmpresaDetailLayout from '@pages/empresas/EmpresaDetailLayout';  // <-- IMPORT NUEVO
import ForceChangePassword from '@pages/auth/ForceChangePassword';
import PerfilPage from '@pages/perfil/PerfilPage';
import ComparativaForm from '@pages/comparativas/ComparativaForm';
import AgendaPage from '@pages/agenda/AgendaPage';
import RenovacionesPage from '@pages/renovaciones/RenovacionesPage';
import { RequireAuth } from '@components/RouteGuards';
import { RequireRole } from '@components/RouteGuards';
import ClienteDetailLayout from '@pages/clientes/ClienteDetailLayout';
import ClienteDocumentos from '@pages/clientes/ClienteDocumentos';
import NotificacionesPage from '@pages/notificaciones/NotificacionesPage';


// --- 1. RUTA RAÍZ ---
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// --- 2. RUTAS PÚBLICAS ---
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/app' });
  },
});
const forceChangePasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/force-change-password',
  component: ForceChangePassword,
});


// --- 3. RUTAS PRIVADAS (EL CRM) ---
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => <RequireAuth><Layout /></RequireAuth>,
});

const notificacionesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notificaciones',
  component: NotificacionesPage,
});
const agendaRoute = createRoute({ getParentRoute: () => appRoute, path: 'agenda', component: () => <RequireRole roles={['administrador', 'comercial']}><AgendaPage /></RequireRole>,})
const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: Dashboard, });
const clientesRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes', component: ClientesList });
const clientesNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/nuevo', component: () => <ClienteForm /> });
export const clienteDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/$id', component: ClienteDetailLayout,});
export const clienteEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/$id/editar', component: function EditCliente() { const { id } = useParams({ from: clienteEditRoute.id }) as {id: string}; return <ClienteForm id={id} />; } }); 
const clienteDetailIndexRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: '/', beforeLoad: ({ params }) => { throw redirect({ to: '/app/clientes/$id/puntos', params }); } });
const clientePuntosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'puntos', component: () => { const { id } = useParams({ from: clientePuntosRoute.id }) as {id: string}; return <PuntosList clienteId={id} />; } }); 
const clienteContratosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'contratos', component: () => { const { id } = useParams({ from: clienteContratosRoute.id }) as {id: string}; return <ContratosList clienteId={id} />; } }); 
export const clienteDocumentosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'documentos/$', component: ClienteDocumentos, });
const puntosRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos', component: PuntosList });
const puntoNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos/nuevo', component: () => <PuntoForm /> });
const puntoEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos/$id', component: function EditPunto() { const { id } = useParams({ from: puntoEditRoute.id }) as {id: string}; return <PuntoForm id={id} />; } }); 
const contratosRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos', component: ContratosList });
const contratoNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos/nuevo', component: () => <ContratoForm /> });
const contratoEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos/$id', component: function EditContrato() { const { id } = useParams({ from: contratoEditRoute.id }) as {id: string}; return <ContratoForm id={id} />; } }); 
const renovacionesRoute = createRoute({ getParentRoute: () => appRoute, path: '/renovaciones', component: () => <RequireRole roles={['administrador', 'comercial']}><RenovacionesPage /></RequireRole>, });
const documentosRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/documentos', 
  component: DocumentosPageWrapper 
});

export const documentosClienteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos-cliente/$', 
  component: ClienteDocumentosExplorer
});

const documentoUploadRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos/subir', component: DocumentoUpload });
const usuariosRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios', component: () => <RequireRole roles={['administrador']}><UsuariosList /></RequireRole>, });
const usuarioInviteRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios/invitar', component: () => <RequireRole roles={['administrador']}><UsuarioInviteForm /></RequireRole>, });
export const usuarioEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios/$id/editar', component: function EditUsuario() { const { id } = useParams({ from: usuarioEditRoute.id }) as {id: string}; return <RequireRole roles={['administrador']}><UsuarioInviteForm userId={id} /></RequireRole>; } }); 
const comparativasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/comparativas/nueva', component: () => <RequireRole roles={['administrador']}><ComparativaForm /></RequireRole>, });
const perfilRoute = createRoute({ getParentRoute: () => appRoute, path: '/perfil', component: PerfilPage, });
export const empresasRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas', component: () => <RequireRole roles={['administrador']}><EmpresasList /></RequireRole>, });
export const empresasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/nueva', component: () => <RequireRole roles={['administrador']}><EmpresaForm /></RequireRole>, });
export const empresasEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/$id/editar', component: function EditEmpresa() { const { id } = useParams({ from: empresasEditRoute.id }) as {id: string}; return <RequireRole roles={['administrador']}><EmpresaForm id={id} /></RequireRole>; } }); 
export const empresasArchivadasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas/archivadas',
  component: () => <RequireRole roles={['administrador']}><EmpresasArchivadasPage /></RequireRole>,
});

// --- NUEVA RUTA: Detalle de Empresa ---
export const empresaDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas/$id',
  component: () => <RequireRole roles={['administrador']}><EmpresaDetailLayout /></RequireRole>,
});
// Sub-rutas de empresa
const empresaClientesRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'clientes', component: () => { const { id } = useParams({ from: empresaDetailRoute.id }) as {id: string}; return <ClientesList empresaId={id} />; } });
const empresaPuntosRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'puntos', component: () => { const { id } = useParams({ from: empresaDetailRoute.id }) as {id: string}; return <PuntosList empresaId={id} />; } });
const empresaContratosRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'contratos', component: () => { const { id } = useParams({ from: empresaDetailRoute.id }) as {id: string}; return <ContratosList empresaId={id} />; } });
const empresaDetailIndexRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: '/', beforeLoad: ({ params }) => { throw redirect({ to: '/app/empresas/$id/clientes', params }); } });


// --- 4. RUTA PARA "NO ENCONTRADO" (404) ---
const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: () => (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Página no encontrada</h2>
      <p>La URL que has introducido no existe.</p>
      <Link to="/app">Volver al Dashboard</Link>
    </div>
  ),
});


// --- 5. CONSTRUCCIÓN DEL ÁRBOL DE RUTAS ---
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forceChangePasswordRoute,
  appRoute.addChildren([
    dashboardRoute,
    perfilRoute,
    notificacionesRoute, 
    comparativasNewRoute,
    agendaRoute,
    empresasRoute,
    empresasNewRoute,
    empresasEditRoute,
    empresasArchivadasRoute,
    // Añadimos la ruta de detalle con sus hijos
    empresaDetailRoute.addChildren([
      empresaDetailIndexRoute,
      empresaClientesRoute,
      empresaPuntosRoute,
      empresaContratosRoute,
    ]),
    usuariosRoute,
    usuarioInviteRoute,
    usuarioEditRoute,
    clientesRoute,
    clientesNewRoute,
    clienteEditRoute,
    clienteDetailRoute.addChildren([
      clienteDetailIndexRoute,
      clientePuntosRoute,
      clienteContratosRoute,
      clienteDocumentosRoute
    ]),
    puntosRoute,
    puntoNewRoute,
    puntoEditRoute,
    contratosRoute,
    contratoNewRoute,
    contratoEditRoute,
    renovacionesRoute,
    documentosRoute, 
    documentosClienteRoute,
    documentoUploadRoute,
  ]),
]);


export const router = createRouter({
  routeTree,
  notFoundRoute,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}