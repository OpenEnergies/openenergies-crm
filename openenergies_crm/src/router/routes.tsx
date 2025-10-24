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
import PerfilPage from '@pages/perfil/PerfilPage';
import ComparativaForm from '@pages/comparativas/ComparativaForm';
import AgendaPage from '@pages/agenda/AgendaPage';
import RenovacionesPage from '@pages/renovaciones/RenovacionesPage';
import { RequireAuth } from '@components/RouteGuards';
import { RequireRole } from '@components/RouteGuards';
import ClienteDetailLayout from '@pages/clientes/ClienteDetailLayout'; // <-- Importa el nuevo layout
import ClienteDocumentos from '@pages/clientes/ClienteDocumentos'; // <-- Importa el nuevo componente que crearemos

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

// Creamos la ruta de la agenda, protegida
const agendaRoute = createRoute({ // <-- 1. Usar createRoute
  getParentRoute: () => appRoute,
  path: 'agenda',
  // 2. Usar el componente RequireRole como en el resto de tus rutas
  component: () => <RequireRole roles={['administrador', 'comercial']}><AgendaPage /></RequireRole>,
})

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

// Esta ruta (la del ID) es el CONTENEDOR de la ficha del cliente (el Layout)
export const clienteDetailRoute = createRoute({ 
  getParentRoute: () => appRoute, 
  path: '/clientes/$id', 
  component: ClienteDetailLayout,
});

// Esta es la ruta específica para el FORMULARIO DE EDICIÓN.
export const clienteEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes/$id/editar',
  component: function EditCliente() {
    const { id } = useParams({ from: clienteEditRoute.id });
    return <ClienteForm id={id} />;
  }
});

// Ruta por defecto al entrar en la ficha (redirige a puntos de suministro)
const clienteDetailIndexRoute = createRoute({
  getParentRoute: () => clienteDetailRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/app/clientes/$id/puntos', params });
  }
});

// Las nuevas rutas anidadas para Puntos, Contratos y Documentos
const clientePuntosRoute = createRoute({
  getParentRoute: () => clienteDetailRoute,
  path: 'puntos',
  component: () => {
    const { id } = useParams({ from: '/app/clientes/$id/puntos' });
    // Reutilizamos el componente existente, pasándole el ID del cliente
    return <PuntosList clienteId={id} />;
  }
});

const clienteContratosRoute = createRoute({
  getParentRoute: () => clienteDetailRoute,
  path: 'contratos',
  component: () => {
    const { id } = useParams({ from: '/app/clientes/$id/contratos' });
    return <ContratosList clienteId={id} />;
  }
});

// Por ahora, una placeholder para documentos
export const clienteDocumentosRoute = createRoute({
  getParentRoute: () => clienteDetailRoute,
  path: 'documentos/$', // <-- '$' es el nombre del parámetro splat
  component: ClienteDocumentos,
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

const renovacionesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/renovaciones',
  component: () => <RequireRole roles={['administrador', 'comercial']}><RenovacionesPage /></RequireRole>,
});

const documentosRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos', component: DocumentosList });
const documentoUploadRoute = createRoute({ getParentRoute: () => appRoute, path: '/documentos/subir', component: DocumentoUpload });

const usuariosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios',
  component: () => <RequireRole roles={['administrador']}><UsuariosList /></RequireRole>,
});
const usuarioInviteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios/invitar',
  component: () => <RequireRole roles={['administrador']}><UsuarioInviteForm /></RequireRole>,
});

export const usuarioEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios/$id/editar', // La ruta es correcta
  // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
  // Añadimos una función 'component' que extrae el 'id' y lo pasa como prop.
  component: function EditUsuario() {
    const { id } = useParams({ from: usuarioEditRoute.id });
    return <RequireRole roles={['administrador']}><UsuarioInviteForm userId={id} /></RequireRole>;
  }
});



// --- AÑADE LA RUTA DE COMPARATIVAS ---
const comparativasNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/comparativas/nueva',
  component: () => <RequireRole roles={['administrador']}><ComparativaForm /></RequireRole>,
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

// --- AÑADE LA RUTA DEL PERFIL ---
const perfilRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/perfil',
  component: PerfilPage,
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
    perfilRoute,
    comparativasNewRoute,
    agendaRoute,
    empresasRoute,     
    empresasNewRoute,  
    empresasEditRoute,
    usuariosRoute,
    usuarioInviteRoute,
    usuarioEditRoute,
    clientesRoute,
    clientesNewRoute,
    clienteEditRoute, // <-- Se añade la nueva ruta de edición aquí
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

