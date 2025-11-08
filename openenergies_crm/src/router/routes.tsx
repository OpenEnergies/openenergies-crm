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
// ... (sin cambios) ...
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

// ... (El resto de definiciones hasta documentosClienteRoute no cambian) ...
const notificacionesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notificaciones',
  component: NotificacionesPage, // Usar el componente creado
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

// --- CORRECCIÓN AQUÍ ---
// Eliminamos la propiedad 'id' explícita
export const documentosClienteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos-cliente/$', 
  // id: '/app/documentos-cliente/$', // <-- ELIMINAR ESTA LÍNEA
  component: ClienteDocumentosExplorer
});
// --- FIN CORRECCIÓN ---

const documentoUploadRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos/subir', component: DocumentoUpload });
const usuariosRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios', component: () => <RequireRole roles={['administrador']}><UsuariosList /></RequireRole>, });
const usuarioInviteRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios/invitar', component: () => <RequireRole roles={['administrador']}><UsuarioInviteForm /></RequireRole>, });
export const usuarioEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios/$id/editar', component: function EditUsuario() { const { id } = useParams({ from: usuarioEditRoute.id }) as {id: string}; return <RequireRole roles={['administrador']}><UsuarioInviteForm userId={id} /></RequireRole>; } }); 
const comparativasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/comparativas/nueva', component: () => <RequireRole roles={['administrador']}><ComparativaForm /></RequireRole>, });
const perfilRoute = createRoute({ getParentRoute: () => appRoute, path: '/perfil', component: PerfilPage, });
export const empresasRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas', component: () => <RequireRole roles={['administrador']}><EmpresasList /></RequireRole>, });
export const empresasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/nueva', component: () => <RequireRole roles={['administrador']}><EmpresaForm /></RequireRole>, });
export const empresasEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/$id', component: function EditEmpresa() { const { id } = useParams({ from: empresasEditRoute.id }) as {id: string}; return <RequireRole roles={['administrador']}><EmpresaForm id={id} /></RequireRole>; } }); 
export const empresasArchivadasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas/archivadas',
  component: () => <RequireRole roles={['administrador']}><EmpresasArchivadasPage /></RequireRole>,
});

// --- 4. RUTA PARA "NO ENCONTRADO" (404) ---
// ... (sin cambios) ...
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
// ... (sin cambios) ...
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
    documentosClienteRoute, // Añadida
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