import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
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
import { RequireAuth } from '@components/RouteGuards';

export const rootRoute = createRootRoute({
  component: () => <Outlet />
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <Login />
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => <RequireAuth><Layout /></RequireAuth>
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: () => <Dashboard />
});

const clientesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes',
  component: () => <ClientesList />
});

const clientesNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes/nuevo',
  component: () => <ClienteForm />
});

const clientesEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes/:id',
  component: () => <ClienteForm />
});

const puntosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos',
  component: () => <PuntosList />
});
const puntoNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos/nuevo',
  component: () => <PuntoForm />
});
const puntoEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos/:id',
  component: () => <PuntoForm />
});

const contratosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos',
  component: () => <ContratosList />
});
const contratoNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos/nuevo',
  component: () => <ContratoForm />
});
const contratoEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos/:id',
  component: () => <ContratoForm />
});

const documentosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos',
  component: () => <DocumentosList />
});
const documentoUploadRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos/subir',
  component: () => <DocumentoUpload />
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    clientesRoute, clientesNewRoute, clientesEditRoute,
    puntosRoute, puntoNewRoute, puntoEditRoute,
    contratosRoute, contratoNewRoute, contratoEditRoute,
    documentosRoute, documentoUploadRoute
  ])
]);

export const router = createRouter({ routeTree });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
