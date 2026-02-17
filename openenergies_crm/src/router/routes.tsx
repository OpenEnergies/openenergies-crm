import { createRootRoute, createRoute, createRouter, Outlet, redirect, NotFoundRoute, Link, useParams } from '@tanstack/react-router';
import Layout from '@components/Layout';
import Login from '@pages/auth/Login';
import Dashboard from '@pages/Dashboard';
// Clientes
import ClientesList from '@pages/clientes/ClientesList';
import ClienteForm from '@pages/clientes/ClienteForm';
import ClienteDetailLayout from '@pages/clientes/ClienteDetailLayout';
import ClienteDocumentos from '@pages/clientes/ClienteDocumentos';
import ClienteActividad from '@pages/clientes/ClienteActividad';
import ClienteFacturas from '@pages/clientes/ClienteFacturas';
// Puntos
import PuntosList from '@pages/puntos/PuntosList';
import PuntoForm from '@pages/puntos/PuntoForm';
import PuntoDetailPage from '@pages/puntos/PuntoDetailPage';
// Contratos
import ContratosList from '@pages/contratos/ContratosList';
import ContratoForm from '@pages/contratos/ContratoForm';
// Documentos
import DocumentosPageWrapper from '@pages/documentos/DocumentosPageWrapper';
import ClienteDocumentosExplorer from '@pages/documentos/ClienteDocumentosExplorer';
import DocumentoUpload from '@pages/documentos/DocumentoUpload';
// Usuarios
import UsuariosList from '@pages/usuarios/UsuariosList';
import UsuarioInviteForm from '@pages/usuarios/UsuarioInviteForm';
// Empresas - Con nuevo layout de detalle
import EmpresasList from '@pages/empresas/EmpresaList';
import EmpresaForm from '@pages/empresas/EmpresaForm';
import EmpresaDetailLayout from '@pages/empresas/EmpresaDetailLayout';
import EmpresaFacturas from '@pages/empresas/EmpresaFacturas';
import EmpresaActividad from '@pages/empresas/EmpresaActividad';
import EmpresaClientes from '@pages/empresas/EmpresaClientes';
import EmpresaPuntos from '@pages/empresas/EmpresaPuntos';
import EmpresaContratos from '@pages/empresas/EmpresaContratos';
// Canales
import CanalesList from '@pages/canales/CanalesList';
// Auth y otros
import ForceChangePassword from '@pages/auth/ForceChangePassword';
import PerfilPage from '@pages/perfil/PerfilPage';
import ComparativaForm from '@pages/comparativas/ComparativaForm';
import AgendaPage from '@pages/agenda/AgendaPage';
import VacacionesPage from '@pages/agenda/VacacionesPage';
import RenovacionesPage from '@pages/renovaciones/RenovacionesPage';
import { RequireAuth, RequireRole } from '@components/RouteGuards';
import NotificacionesPage from '@pages/notificaciones/NotificacionesPage';
import FacturasList from '@pages/facturas/FacturasList';
import FacturaForm from '@pages/facturas/FacturaForm';
import FacturaImport from '@pages/facturas/FacturaImport';
import AnalyticsPage from '@pages/analytics/AnalyticsPage';
import ActividadPage from '@pages/analytics/ActividadPage';
// Informes de Mercado
import { InformesPage } from '@pages/informes';


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
const agendaRoute = createRoute({ getParentRoute: () => appRoute, path: 'agenda', component: () => <RequireRole roles={['administrador']}><AgendaPage /></RequireRole>, })
const vacacionesRoute = createRoute({ getParentRoute: () => appRoute, path: 'agenda/vacaciones', component: () => <RequireRole roles={['administrador']}><VacacionesPage /></RequireRole>, })
const dashboardRoute = createRoute({ getParentRoute: () => appRoute, path: '/', component: Dashboard, });
const clientesRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes', component: ClientesList });
const clientesNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/nuevo', component: () => <ClienteForm /> });
export const clienteDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/$id', component: ClienteDetailLayout, });
export const clienteEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes/$id/editar', component: function EditCliente() { const { id } = useParams({ from: clienteEditRoute.id }); return <ClienteForm id={id} />; } });
const clienteDetailIndexRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: '/', beforeLoad: ({ params }) => { throw redirect({ to: '/app/clientes/$id/puntos', params }); } });
const clientePuntosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'puntos', component: () => { const { id } = useParams({ from: clientePuntosRoute.id }); return <PuntosList clienteId={id} hideClienteColumn />; } });
const clienteContratosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'contratos', component: () => { const { id } = useParams({ from: clienteContratosRoute.id }); return <ContratosList clienteId={id} hideClienteColumn />; } });
export const clienteDocumentosRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'documentos/$', component: ClienteDocumentos, });
const clienteFacturasRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'facturas', component: ClienteFacturas });
const clienteActividadRoute = createRoute({ getParentRoute: () => clienteDetailRoute, path: 'actividad', component: ClienteActividad });
const puntosRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos', component: PuntosList });
const puntoNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos/nuevo', component: () => <PuntoForm /> });
const puntoEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos/$id', component: function EditPunto() { const { id } = useParams({ from: puntoEditRoute.id }); return <PuntoForm id={id} />; } });
const puntoDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos/$id/detalle', component: PuntoDetailPage });
const contratosRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos', component: ContratosList });
const contratoNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos/nuevo', component: () => <ContratoForm /> });
const contratoEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos/$id', component: function EditContrato() { const { id } = useParams({ from: contratoEditRoute.id }); return <ContratoForm id={id} />; } });
const renovacionesRoute = createRoute({ getParentRoute: () => appRoute, path: '/renovaciones', component: () => <RequireRole roles={['administrador']}><RenovacionesPage /></RequireRole>, });
const documentosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos',
  component: DocumentosPageWrapper
});
const facturasGlobalRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/facturas',
  component: FacturasList
});
const facturaNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/facturas/nuevo',
  component: () => <FacturaForm />
});
export const facturaEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/facturas/$id',
  component: function EditFactura() {
    const { id } = useParams({ from: facturaEditRoute.id });
    return <FacturaForm id={id} />;
  }
});
const facturaImportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/facturas/importar',
  component: FacturaImport
});

const analyticsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/analiticas',
  component: () => <RequireRole roles={['administrador', 'comercial', 'cliente']}><AnalyticsPage /></RequireRole>,
});

const actividadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/actividad',
  component: () => <RequireRole roles={['administrador']}><ActividadPage /></RequireRole>,
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
export const usuarioEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/usuarios/$id/editar', component: function EditUsuario() { const { id } = useParams({ from: usuarioEditRoute.id }); return <RequireRole roles={['administrador']}><UsuarioInviteForm userId={id} /></RequireRole>; } });
const perfilRoute = createRoute({ getParentRoute: () => appRoute, path: '/perfil', component: PerfilPage, });
export const empresasRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas', component: () => <RequireRole roles={['administrador']}><EmpresasList /></RequireRole>, });
export const empresasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/nueva', component: () => <RequireRole roles={['administrador']}><EmpresaForm /></RequireRole>, });
export const empresaDetailRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/$id', component: () => <RequireRole roles={['administrador']}><EmpresaDetailLayout /></RequireRole>, });
const empresaDetailIndexRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: '/', beforeLoad: ({ params }) => { throw redirect({ to: '/app/empresas/$id/clientes', params: { id: params.id } }); }, component: () => null });
const empresaClientesRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'clientes', component: EmpresaClientes });
const empresaPuntosRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'puntos', component: EmpresaPuntos });
const empresaContratosRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'contratos', component: EmpresaContratos });
const empresaFacturasRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'facturas', component: EmpresaFacturas });
const empresaActividadRoute = createRoute({ getParentRoute: () => empresaDetailRoute, path: 'actividad', component: EmpresaActividad });
export const empresasEditRoute = createRoute({ getParentRoute: () => appRoute, path: '/empresas/$id/editar', component: function EditEmpresa() { const { id } = useParams({ from: empresasEditRoute.id }); return <RequireRole roles={['administrador']}><EmpresaForm id={id} /></RequireRole>; } });
export const canalesRoute = createRoute({ getParentRoute: () => appRoute, path: '/canales', component: () => <RequireRole roles={['administrador']}><CanalesList /></RequireRole>, });

export const comparativasNewRoute = createRoute({ getParentRoute: () => appRoute, path: '/comparativas/nueva', component: ComparativaForm });
export const informesMercadoRoute = createRoute({ getParentRoute: () => appRoute, path: '/informes', component: () => <RequireRole roles={['administrador']}><InformesPage /></RequireRole> });


// --- 4. CONTINUACIÓN: NOT FOUND COMPONENT ---
const NotFoundComponent = () => (
  <div style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>Página no encontrada</h2>
    <p>La URL que has introducido no existe.</p>
    <Link to="/app">Volver al Dashboard</Link>
  </div>
);


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
    vacacionesRoute,
    empresasRoute,
    empresasNewRoute,
    empresasEditRoute,
    empresaDetailRoute.addChildren([
      empresaDetailIndexRoute,
      empresaClientesRoute,
      empresaPuntosRoute,
      empresaContratosRoute,
      empresaFacturasRoute,
      empresaActividadRoute,
    ]),
    canalesRoute,
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
      clienteDocumentosRoute,
      clienteFacturasRoute,
      clienteActividadRoute
    ]),
    puntosRoute,
    puntoNewRoute,
    puntoDetailRoute,
    puntoEditRoute,
    contratosRoute,
    contratoNewRoute,
    contratoEditRoute,
    renovacionesRoute,
    documentosRoute,
    facturasGlobalRoute,
    facturaNewRoute,
    facturaEditRoute,
    facturaImportRoute,
    documentosClienteRoute, // Añadida
    documentoUploadRoute,
    analyticsRoute,
    actividadRoute,
    informesMercadoRoute,
  ]),
]);


export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundComponent,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}