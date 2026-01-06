import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@lib/supabase'

export default function AppLayout() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Lee sesión y escucha cambios de auth
  useEffect(() => {
    let isMounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s)
    })
    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Redirige a /login si no hay sesión
  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: '/login' })
    }
  }, [loading, session, navigate])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  // Cargando estado de auth
  if (loading) {
    return (
      <main className="p-6">
        <p className="text-slate-600">Cargando…</p>
      </main>
    )
  }

  // Layout principal
  return (
    <div className="min-h-screen flex bg-[#F7FAFC] text-[#0F172A]">
      {/* Sidebar */}
      <aside
        aria-label="Navegación principal"
        className="hidden md:flex w-64 flex-col gap-2 p-4 border-r border-slate-200 bg-white"
      >
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Open Energies</h1>
          <p className="text-sm text-slate-500">CRM</p>
        </div>

        <nav className="flex flex-col gap-1">
          <Link
            to="/app/clientes"
            className="rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Clientes
          </Link>
          <Link
            to="/app/puntos"
            className="rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Puntos
          </Link>
          <Link
            to="/app/contratos"
            className="rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Contratos
          </Link>
          <Link
            to="/app/documentos"
            className="rounded-lg px-3 py-2 hover:bg-slate-100"
          >
            Documentos
          </Link>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200">
          <button
            onClick={handleSignOut}
            className="w-full rounded-lg bg-[#2E87E5] hover:bg-[#1F6EC2] text-white px-3 py-2"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <section className="flex-1 flex flex-col">
        {/* Topbar (visible en móvil también) */}
        <header className="md:hidden flex items-center justify-between gap-2 p-3 border-b border-slate-200 bg-white">
          <div>
            <strong>Open Energies</strong>
          </div>
          <div className="flex gap-2">
            <Link to="/app/clientes" className="text-sm underline">Clientes</Link>
            <Link to="/app/puntos" className="text-sm underline">Puntos</Link>
            <Link to="/app/contratos" className="text-sm underline">Contratos</Link>
            <Link to="/app/documentos" className="text-sm underline">Docs</Link>
          </div>
        </header>

        <main className="p-4">
          <Outlet />
        </main>
      </section>
    </div>
  )
}

