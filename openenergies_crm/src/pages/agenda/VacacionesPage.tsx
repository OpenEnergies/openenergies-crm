// src/pages/agenda/VacacionesPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { supabase } from '@lib/supabase';
import { useSession } from '@hooks/useSession';
import { Loader2, Plus, Trash2, ArrowLeft, Calendar, User, Clock, X, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '@components/ConfirmationModal';

interface UsuarioOption {
  user_id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  rol: string;
  empresa_id: string;
}

interface Vacacion {
  id: string;
  user_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_totales: number;
  descripcion: string | null;
  creado_en: string;
  usuarios_app?: {
    nombre: string;
    apellidos: string | null;
    email: string;
    rol: string;
  };
}

interface VacacionFormModalProps {
  onClose: () => void;
  currentUserId: string;
  currentEmpresaId: string | null;
  isAdmin: boolean;
}

function VacacionFormModal({ onClose, currentUserId, currentEmpresaId, isAdmin }: VacacionFormModalProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // Cargar usuarios (administradores y comerciales) para el selector
  const { data: usuarios, isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios-vacaciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios_app')
        .select('user_id, nombre, apellidos, email, rol, empresa_id')
        .in('rol', ['administrador', 'comercial'])
        .eq('activo', true)
        .is('eliminado_en', null)
        .order('nombre');

      if (error) throw error;
      return (data || []) as UsuarioOption[];
    },
    enabled: isAdmin, // Solo cargar si es admin
  });

  const selectedUser = usuarios?.find(u => u.user_id === selectedUserId);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) {
        throw new Error('Debes seleccionar un usuario');
      }
      if (!fechaInicio || !fechaFin) {
        throw new Error('Las fechas son requeridas');
      }
      if (new Date(fechaFin) < new Date(fechaInicio)) {
        throw new Error('La fecha de fin debe ser igual o posterior a la de inicio');
      }

      // Determinar empresa_id: si seleccionó usuario, usa su empresa; sino, la del usuario actual
      const targetEmpresaId = isAdmin && selectedUser ? selectedUser.empresa_id : currentEmpresaId;

      if (!targetEmpresaId) {
        throw new Error('No se ha podido determinar la empresa asociada.');
      }

      // No enviamos estado (usa el DEFAULT 'pendiente')
      const { error } = await supabase.from('vacaciones').insert({
        user_id: selectedUserId,
        empresa_id: targetEmpresaId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        descripcion: descripcion || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vacaciones añadidas correctamente');
      queryClient.invalidateQueries({ queryKey: ['vacaciones'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const diasCalculados = fechaInicio && fechaFin
    ? Math.max(0, Math.ceil((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-modal w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bg-intermediate">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-fenix-400" />
            Añadir Vacaciones
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-bg-intermediate rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Selector de usuario (solo para admin) */}
          {isAdmin && (
            <div className="space-y-2">
              <label htmlFor="usuario" className="text-sm font-medium text-gray-300">
                Usuario *
              </label>
              {loadingUsuarios ? (
                <div className="flex items-center gap-2 p-3 text-gray-500">
                  <Loader2 className="animate-spin w-4 h-4" />
                  <span>Cargando usuarios...</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="usuario"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="glass-input w-full appearance-none pr-10"
                  >
                    <option value="">Selecciona un usuario</option>
                    {usuarios?.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.nombre} {u.apellidos || ''} ({u.rol})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              )}
              {selectedUser && (
                <p className="text-xs text-gray-400">
                  {selectedUser.email}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="fecha_inicio" className="text-sm font-medium text-gray-300">Fecha de inicio *</label>
            <input
              type="date"
              id="fecha_inicio"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              onClick={(e) => {
                const input = e.currentTarget;
                if (input.showPicker) {
                  input.showPicker();
                }
              }}
              className="glass-input w-full cursor-pointer"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="fecha_fin" className="text-sm font-medium text-gray-300">Fecha de fin *</label>
            <input
              type="date"
              id="fecha_fin"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              onClick={(e) => {
                const input = e.currentTarget;
                if (input.showPicker) {
                  input.showPicker();
                }
              }}
              min={fechaInicio}
              className="glass-input w-full cursor-pointer"
              required
            />
          </div>

          {diasCalculados > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-fenix-500/20 border border-fenix-500/30 text-fenix-200">
              <Clock size={16} />
              <span><strong>{diasCalculados}</strong> día{diasCalculados !== 1 ? 's' : ''} de vacaciones</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-sm font-medium text-gray-300">Descripción (opcional)</label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="glass-input w-full resize-none"
              placeholder="Ej: Vacaciones de verano"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-bg-intermediate bg-black/20 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-fenix-500 hover:bg-fenix-400 text-white font-medium shadow-lg shadow-fenix-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => createMutation.mutate()}
            disabled={!selectedUserId || !fechaInicio || !fechaFin || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="animate-spin w-5 h-5" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VacacionesPage() {
  const { userId, rol, empresaId, loading: sessionLoading } = useSession();
  const isAdmin = rol === 'administrador';
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vacacionToDelete, setVacacionToDelete] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const { data: vacaciones, isLoading } = useQuery({
    queryKey: ['vacaciones', userId, rol],
    queryFn: async () => {
      const currentIsAdmin = rol === 'administrador';

      // Primero obtenemos las vacaciones
      let query = supabase
        .from('vacaciones')
        .select('*')
        .is('eliminado_en', null)
        .order('fecha_inicio', { ascending: false });

      // Solo filtrar por user_id si NO es admin
      if (!currentIsAdmin && userId) {
        query = query.eq('user_id', userId);
      }

      const { data: vacacionesData, error } = await query;
      if (error) throw error;

      if (!vacacionesData || vacacionesData.length === 0) {
        return [] as Vacacion[];
      }

      // Obtenemos los user_ids únicos
      const userIds = [...new Set(vacacionesData.map(v => v.user_id))];

      // Obtenemos los datos de usuarios_app para esos user_ids
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('usuarios_app')
        .select('user_id, nombre, apellidos, email, rol')
        .in('user_id', userIds);

      if (usuariosError) {
        console.error('Error fetching usuarios:', usuariosError);
      }

      // Mapeamos usuarios por user_id
      const usuariosMap = new Map(
        (usuariosData || []).map(u => [u.user_id, u])
      );

      // Combinamos los datos
      const result = vacacionesData.map(v => ({
        ...v,
        usuarios_app: usuariosMap.get(v.user_id) || null,
      }));

      return result as Vacacion[];
    },
    enabled: !!userId && !!rol && !sessionLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vacaciones')
        .update({ eliminado_en: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vacaciones eliminadas');
      queryClient.invalidateQueries({ queryKey: ['vacaciones'] });
      setVacacionToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const vacacionesPorUsuario = vacaciones?.reduce((acc, v) => {
    const key = v.user_id;
    if (!acc[key]) {
      acc[key] = {
        nombre: v.usuarios_app ? `${v.usuarios_app.nombre} ${v.usuarios_app.apellidos || ''}`.trim() : 'Usuario',
        email: v.usuarios_app?.email || '',
        rol: v.usuarios_app?.rol || '',
        totalDias: 0,
        periodos: [],
      };
    }
    acc[key].totalDias += v.dias_totales || 0;
    acc[key].periodos.push(v);
    return acc;
  }, {} as Record<string, { nombre: string; email: string; rol: string; totalDias: number; periodos: Vacacion[] }>);

  // Ordenar los períodos de cada usuario por fecha ascendente (próximas primero)
  if (vacacionesPorUsuario) {
    Object.values(vacacionesPorUsuario).forEach(userData => {
      userData.periodos.sort((a, b) =>
        new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
      );
    });
  }

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Función para determinar si un período es próximo (en los próximos 30 días)
  const isPeriodoProximo = (fechaInicio: string) => {
    const hoy = new Date();
    const inicio = new Date(fechaInicio);
    const diffDias = Math.ceil((inicio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diffDias >= 0 && diffDias <= 30;
  };

  // Función para determinar si un período está en curso
  const isPeriodoEnCurso = (fechaInicio: string, fechaFin: string) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    return hoy >= inicio && hoy <= fin;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/app/agenda"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-bg-intermediate transition-colors cursor-pointer"
            title="Volver a Agenda"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-white">Gestión de Vacaciones</h2>
            <p className="text-gray-400">
              {isAdmin ? 'Gestiona las vacaciones de todos los usuarios' : 'Gestiona tus períodos de vacaciones'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/agenda"
            search={{ showVacaciones: 'true' }}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 hover:text-orange-200 rounded-lg border border-orange-500/30 transition-colors cursor-pointer"
            title="Ver vacaciones en el calendario"
          >
            <Eye size={16} />
            <span className="text-sm font-medium">Ver en Calendario</span>
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-fenix-500 hover:bg-fenix-400 text-white rounded-lg transition-colors shadow-lg shadow-fenix-500/20 cursor-pointer"
          >
            <Plus size={18} /> Añadir Vacaciones
          </button>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-fenix-500" size={32} />
          <p className="text-gray-400">Cargando vacaciones...</p>
        </div>
      ) : !vacaciones || vacaciones.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <Calendar size={48} className="text-gray-600 mb-2" />
          <h3 className="text-xl font-medium text-white">No hay vacaciones registradas</h3>
          <p className="text-gray-400">Haz clic en "Añadir Vacaciones" para crear tu primer período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cards colapsables por usuario */}
          {vacacionesPorUsuario && Object.entries(vacacionesPorUsuario).map(([userIdKey, userData]) => {
            const isExpanded = expandedUsers.has(userIdKey);
            const tieneVacacionEnCurso = userData.periodos.some(p => isPeriodoEnCurso(p.fecha_inicio, p.fecha_fin));
            const tieneVacacionProxima = userData.periodos.some(p => isPeriodoProximo(p.fecha_inicio) && !isPeriodoEnCurso(p.fecha_inicio, p.fecha_fin));

            return (
              <div key={userIdKey} className="glass-card overflow-hidden transition-all duration-300">
                {/* Header de la card (siempre visible) */}
                <button
                  onClick={() => toggleUserExpanded(userIdKey)}
                  className="w-full p-4 flex items-center justify-between hover:bg-fenix-500/8 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fenix-500 to-fenix-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-fenix-500/20 cursor-pointer">
                      {userData.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{userData.nombre}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-bg-intermediate text-gray-400 capitalize">
                          {userData.rol}
                        </span>
                        {tieneVacacionEnCurso && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                            En vacaciones
                          </span>
                        )}
                        {tieneVacacionProxima && !tieneVacacionEnCurso && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 font-medium">
                            Próximamente
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">{userData.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xl font-bold text-fenix-400">{userData.totalDias}</div>
                      <div className="text-xs text-gray-400">
                        {userData.periodos.length} período{userData.periodos.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className={`p-2 rounded-lg transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </button>

                {/* Contenido expandible */}
                {isExpanded && (
                  <div className="border-t border-fenix-500/10 animate-fade-in">
                    <div className="p-4 space-y-3">
                      {userData.periodos.map((v) => {
                        const enCurso = isPeriodoEnCurso(v.fecha_inicio, v.fecha_fin);
                        const proximo = isPeriodoProximo(v.fecha_inicio) && !enCurso;

                        return (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between p-4 rounded-xl transition-colors ${enCurso
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : proximo
                                ? 'bg-amber-500/10 border border-amber-500/30'
                                : 'bg-bg-intermediate border border-transparent'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${enCurso
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : proximo
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-bg-intermediate text-gray-400'
                                }`}>
                                <Calendar size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">
                                    {formatFecha(v.fecha_inicio)} - {formatFecha(v.fecha_fin)}
                                  </span>
                                  {enCurso && (
                                    <span className="text-xs text-emerald-400 font-medium">
                                      (En curso)
                                    </span>
                                  )}
                                  {proximo && (
                                    <span className="text-xs text-amber-400 font-medium">
                                      (Próximo)
                                    </span>
                                  )}
                                </div>
                                {v.descripcion && (
                                  <p className="text-sm text-gray-400 italic mt-0.5">
                                    {v.descripcion}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-fenix-500/10 text-fenix-400">
                                <Clock size={14} />
                                <span className="font-semibold">{v.dias_totales}</span>
                                <span className="text-sm">día{v.dias_totales !== 1 ? 's' : ''}</span>
                              </div>
                              <button
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVacacionToDelete(v.id);
                                }}
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para añadir vacaciones */}
      {isModalOpen && userId && (
        <VacacionFormModal
          onClose={() => setIsModalOpen(false)}
          currentUserId={userId}
          currentEmpresaId={empresaId}
          isAdmin={isAdmin}
        />
      )}

      {/* Modal de confirmación para eliminar */}
      {vacacionToDelete && (
        <ConfirmationModal
          isOpen={!!vacacionToDelete}
          title="Eliminar Vacaciones"
          message="¿Estás seguro de que quieres eliminar este período de vacaciones?"
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={() => deleteMutation.mutate(vacacionToDelete)}
          onClose={() => setVacacionToDelete(null)}
          isConfirming={deleteMutation.isPending}
          confirmButtonClass="danger"
        />
      )}
    </div>
  );
}

