// src/router/routes.tsx
import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { RequireRole } from '@components/RouteGuards';

// Páginas
import Login from '@pages/auth/Login'
import AppLayout from '@pages/layouts/AppLayout'
import ClientesList from '@pages/clientes/ClientesList'
import ClienteForm from '@pages/clientes/ClienteForm'
import PuntosList from '@pages/puntos/PuntosList'
import PuntoForm from '@pages/puntos/PuntoForm'
import ContratosList from '@pages/contratos/ContratosList'
import ContratoForm from '@pages/contratos/ContratoForm'
import DocumentosList from '@pages/documentos/DocumentosList'
import DocumentoUpload from '@pages/documentos/DocumentoUpload'
import UsuariosList from '@pages/usuarios/UsuariosList';
import UsuarioInviteForm from '@pages/usuarios/UsuarioInviteForm';
import Layout from '@components/Layout';


const usuariosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios',
  component: () => (
    <RequireRole roles={['administrador', 'comercializadora']}>
      <UsuariosList />
    </RequireRole>
  )
});

const usuarioInviteRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/usuarios/invitar',
  component: () => (
    <RequireRole roles={['administrador', 'comercializadora']}>
      <UsuarioInviteForm />
    </RequireRole>
  )
});

const rootRoute = createRootRoute({
  component: () => <Outlet />
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // Esta función se ejecuta antes de cargar la ruta
    // y redirige al usuario a /app
    throw redirect({
      to: '/app',
    })
  }
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppLayout,
})

// 👇🏼 hijos **relativos** (SIN /app delante)
const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/', // index de /app
  beforeLoad: () => {
    throw redirect({ to: '/app/clientes' })
  },
})

const clientesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes',
  component: ClientesList,
})
const clienteNuevoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes/nuevo',
  component: ClienteForm,
})
const clienteDetalleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/clientes/:id',
  component: ClienteForm,
})

const puntosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos',
  component: PuntosList,
})
const puntoNuevoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos/nuevo',
  component: PuntoForm,
})
const puntoDetalleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/puntos/:id',
  component: PuntoForm,
})

const contratosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos',
  component: ContratosList,
})
const contratoNuevoRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos/nuevo',
  component: ContratoForm,
})
const contratoDetalleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contratos/:id',
  component: ContratoForm,
})

const documentosRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos',
  component: DocumentosList,
})
const documentoSubirRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/documentos/subir',
  component: DocumentoUpload,
})

export const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    appIndexRoute,
    clientesRoute,
    clienteNuevoRoute,
    clienteDetalleRoute,
    puntosRoute,
    puntoNuevoRoute,
    puntoDetalleRoute,
    contratosRoute,
    contratoNuevoRoute,
    contratoDetalleRoute,
    documentosRoute,
    usuariosRoute, 
    usuarioInviteRoute,
    documentoSubirRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

