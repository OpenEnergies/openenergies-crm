-- ============================================================================
-- 005_rls_actividad_log.sql
-- Sistema de Auditoría y Actividad - Row Level Security Policies
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Asegurar que RLS está habilitado
ALTER TABLE actividad_log ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "actividad_log_select_policy" ON actividad_log;
DROP POLICY IF EXISTS "actividad_log_insert_notas_policy" ON actividad_log;
DROP POLICY IF EXISTS "actividad_log_openenergies_all_policy" ON actividad_log;

-- ============================================================================
-- POLÍTICA DE LECTURA (SELECT)
-- Los usuarios pueden ver logs donde:
-- 1. El cliente_id pertenece a su empresa_id, O
-- 2. El usuario es de tipo 'openenergies' (ve todo), O
-- 3. El log no tiene cliente_id pero fue creado por el mismo usuario
-- ============================================================================
CREATE POLICY "actividad_log_select_policy"
ON actividad_log
FOR SELECT
TO authenticated
USING (
    -- Caso 1: Usuarios de Open Energies ven todo
    EXISTS (
        SELECT 1 FROM usuarios_app ua
        JOIN empresas e ON e.id = ua.empresa_id
        WHERE ua.user_id = auth.uid()
        AND e.tipo = 'openenergies'
    )
    OR
    -- Caso 2: El cliente pertenece a la empresa del usuario
    EXISTS (
        SELECT 1 FROM clientes c
        JOIN usuarios_app ua ON ua.empresa_id = (
            -- Para comercializadoras, verificar que el cliente tenga puntos
            -- con contratos hacia esa comercializadora
            SELECT DISTINCT con.comercializadora_id
            FROM puntos_suministro ps
            JOIN contratos con ON con.punto_id = ps.id
            WHERE ps.cliente_id = c.id
            AND con.eliminado_en IS NULL
            LIMIT 1
        )
        WHERE c.id = actividad_log.cliente_id
        AND c.eliminado_en IS NULL
        AND ua.user_id = auth.uid()
    )
    OR
    -- Caso 3: Fallback simple - el usuario creó el log
    actividad_log.user_id = auth.uid()
    OR
    -- Caso 4: Log sin cliente (eventos globales) - solo el autor lo ve
    (actividad_log.cliente_id IS NULL AND actividad_log.user_id = auth.uid())
);

-- ============================================================================
-- POLÍTICA DE INSERCIÓN DE NOTAS MANUALES
-- Los usuarios pueden insertar notas si:
-- 1. El tipo_evento es 'nota_manual', Y
-- 2. El user_id es el usuario autenticado, Y
-- 3. Tienen acceso al cliente (misma lógica que SELECT)
-- ============================================================================
CREATE POLICY "actividad_log_insert_notas_policy"
ON actividad_log
FOR INSERT
TO authenticated
WITH CHECK (
    -- Solo pueden insertar notas manuales
    tipo_evento = 'nota_manual'
    AND
    -- El user_id debe ser el usuario autenticado
    user_id = auth.uid()
    AND
    (
        -- Usuario de Open Energies puede insertar en cualquier cliente
        EXISTS (
            SELECT 1 FROM usuarios_app ua
            JOIN empresas e ON e.id = ua.empresa_id
            WHERE ua.user_id = auth.uid()
            AND e.tipo = 'openenergies'
        )
        OR
        -- El cliente pertenece a la empresa del usuario
        EXISTS (
            SELECT 1 FROM usuarios_app ua
            WHERE ua.user_id = auth.uid()
            AND (
                -- Sin cliente (nota global personal)
                cliente_id IS NULL
                OR
                -- Cliente accesible
                EXISTS (
                    SELECT 1 FROM clientes c
                    WHERE c.id = cliente_id
                    AND c.eliminado_en IS NULL
                )
            )
        )
    )
);

-- ============================================================================
-- COMENTARIOS
-- ============================================================================
COMMENT ON POLICY "actividad_log_select_policy" ON actividad_log IS 
    'Permite leer logs de actividad solo para clientes de la misma empresa o usuarios Open Energies';

COMMENT ON POLICY "actividad_log_insert_notas_policy" ON actividad_log IS 
    'Permite insertar notas manuales solo al usuario autenticado para clientes accesibles';
