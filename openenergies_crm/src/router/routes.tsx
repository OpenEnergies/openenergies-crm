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
import DocumentosList from '@pages/documentos/DocumentosList';
import DocumentoUpload from '@pages/documentos/DocumentoUpload';
import UsuariosList from '@pages/usuarios/UsuariosList';
import UsuarioInviteForm from '@pages/usuarios/UsuarioInviteForm';
import EmpresasList from '@pages/empresas/EmpresasList';
import EmpresaForm from '@pages/empresas/EmpresaForm';
import ForceChangePassword from '@pages/auth/ForceChangePassword';
import { RequireAuth } from '@components/RouteGuards';
import { RequireRole } from '@components/RouteGuards';


// --- 1. RUTA RAÍZ ---
// Es el contenedor principal de toda la aplicación.
export const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// --- 2. RUTAS PÚBLICAS ---

// Ruta para la página de login
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

// Ruta para la raíz del sitio ('/')
// Redirige automáticamente al área privada para una mejor experiencia.
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

// Ruta base para toda el área privada.
// Protegida por el guardia de autenticación.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => <RequireAuth><Layout /></RequireAuth>,
});

// ESTA ES LA RUTA ÍNDICE (EL DASHBOARD)
// Al tener path: '/', se convierte en la página por defecto de '/app'.
// Su URL final es '/app' o '/app/'.
const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: Dashboard,
});

// --- Definición de todas las demás rutas del CRM ---
const clientesRoute = createRoute({ getParentRoute: () => appRoute, path: '/clientes', component: ClientesList });
const clientesNewRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/clientes/nuevo', 
  component: () => <ClienteForm /> 
});

// La ruta EDITAR usa useParams y le pasa el 'id' al formulario
const clientesEditRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/clientes/$id', 
  component: function EditCliente() {
    const { id } = useParams({ from: clientesEditRoute.id });
    return <ClienteForm id={id} />;
  }
});

const puntosRoute = createRoute({ getParentRoute: () => appRoute, path: '/puntos', component: PuntosList });
const puntoNewRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/puntos/nuevo', 
  component: () => <PuntoForm /> 
});
const puntoEditRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/puntos/$id', 
  component: function EditPunto() {
    const { id } = useParams({ from: puntoEditRoute.id });
    return <PuntoForm id={id} />;
  }
});

const contratosRoute = createRoute({ getParentRoute: () => appRoute, path: '/contratos', component: ContratosList });
const contratoNewRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/contratos/nuevo', 
  component: () => <ContratoForm /> 
});
const contratoEditRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/contratos/$id', 
  component: function EditContrato() {
    const { id } = useParams({ from: contratoEditRoute.id });
    return <ContratoForm id={id} />;
  }
});

const documentosRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos', component: DocumentosList });
const documentoUploadRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos/subir', component: DocumentoUpload });

const usuariosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios',
  component: () => <RequireRole roles={['administrador', 'comercializadora']}><UsuariosList /></RequireRole>,
});
const usuarioInviteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios/invitar',
  component: () => <RequireRole roles={['administrador', 'comercializadora']}><UsuarioInviteForm /></RequireRole>,
});

// --- 4. RUTA PARA "NO ENCONTRADO" (404) ---
// Una página amigable para cuando el usuario va a una URL que no existe.
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

// --- AÑADE LAS RUTAS DE EMPRESAS ---
export const empresasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas',
  component: () => <RequireRole roles={['administrador']}><EmpresasList /></RequireRole>,
});
export const empresasNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas/nueva',
  // La ruta para crear simplemente renderiza el formulario sin 'id'
  component: () => <RequireRole roles={['administrador']}><EmpresaForm /></RequireRole>,
});
export const empresasEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/empresas/$id',
  // La ruta para editar usa useParams y le pasa el 'id' al formulario
  component: function EditEmpresa() {
    const { id } = useParams({ from: empresasEditRoute.id });
    return <RequireRole roles={['administrador']}><EmpresaForm id={id} /></RequireRole>;
  }
});


// --- 5. CONSTRUCCIÓN DEL ÁRBOL DE RUTAS ---
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forceChangePasswordRoute,
  appRoute.addChildren([
    dashboardRoute, // El Dashboard es la primera ruta hija
    empresasRoute,     
    empresasNewRoute,  
    empresasEditRoute,
    usuariosRoute,
    usuarioInviteRoute,
    clientesRoute,
    clientesNewRoute,
    clientesEditRoute,
    puntosRoute,
    puntoNewRoute,
    puntoEditRoute,
    contratosRoute,
    contratoNewRoute,
    contratoEditRoute,
    documentosRoute,
    documentoUploadRoute,
  ]),
]);

export const router = createRouter({ 
  routeTree,
  notFoundRoute, // Añadimos la ruta 404
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

