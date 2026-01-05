-- ============================================================================
-- 006_gdpr_system.sql
-- SISTEMA COMPLETO DE CUMPLIMIENTO GDPR
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 5/6/7/12/13/14/15/16/17/18/20/21/30/33/34
-- ISO 27001 A.18.1, NIS2 Art. 23, SOC 2 CC5.2
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script implementa el sistema GDPR completo:
-- 1. Tabla de solicitudes de eliminación (Art. 17 - Derecho al olvido)
-- 2. Funciones de anonimización (parcial y total)
-- 3. Funciones de verificación de dependencias legales
-- 4. Sistema de procesamiento automático de solicitudes
-- 5. Exportación de datos personales (Art. 15/20 - Portabilidad)
-- 6. Registro de consentimientos (Art. 6/7)

BEGIN;

-- ============================================================================
-- SECCIÓN 1: TABLA DE SOLICITUDES DE ELIMINACIÓN
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_eliminacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información del titular de datos
    tipo_sujeto TEXT NOT NULL CHECK (tipo_sujeto IN ('cliente', 'comercial', 'usuario')),
    sujeto_id UUID NOT NULL,  -- ID del registro a eliminar
    email_sujeto TEXT,
    nombre_sujeto TEXT,
    
    -- Información de la solicitud
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    motivo TEXT,  -- Motivo proporcionado por el sujeto
    metodo_solicitud TEXT CHECK (metodo_solicitud IN ('email', 'formulario', 'telefono', 'presencial', 'api')),
    
    -- Estado del procesamiento
    estado TEXT NOT NULL DEFAULT 'pendiente' 
        CHECK (estado IN ('pendiente', 'en_revision', 'aprobada', 'rechazada', 
                          'procesando', 'completada', 'parcial', 'error')),
    
    -- Fechas de procesamiento
    fecha_revision TIMESTAMPTZ,
    fecha_procesamiento TIMESTAMPTZ,
    fecha_completado TIMESTAMPTZ,
    fecha_limite TIMESTAMPTZ,  -- GDPR: 30 días desde solicitud
    
    -- Usuarios responsables
    solicitado_por UUID REFERENCES auth.users(id),  -- Puede ser el propio usuario
    revisado_por UUID REFERENCES auth.users(id),
    procesado_por UUID REFERENCES auth.users(id),
    
    -- Resultado del procesamiento
    tipo_eliminacion TEXT CHECK (tipo_eliminacion IN ('total', 'parcial', 'anonimizacion')),
    motivo_rechazo TEXT,
    
    -- Registros afectados (para auditoría)
    registros_eliminados JSONB DEFAULT '{}'::jsonb,
    registros_anonimizados JSONB DEFAULT '{}'::jsonb,
    registros_conservados JSONB DEFAULT '{}'::jsonb,  -- Con motivo legal
    
    -- Retención legal
    tiene_obligacion_fiscal BOOLEAN DEFAULT FALSE,
    fecha_fin_retencion_fiscal TIMESTAMPTZ,  -- 10 años desde última factura
    
    -- Metadatos
    notas_internas TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    creado_en TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modificado_en TIMESTAMPTZ
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado 
    ON public.solicitudes_eliminacion (estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha 
    ON public.solicitudes_eliminacion (fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_limite 
    ON public.solicitudes_eliminacion (fecha_limite) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_sujeto 
    ON public.solicitudes_eliminacion (sujeto_id);

COMMENT ON TABLE public.solicitudes_eliminacion IS 
'Registro de solicitudes de eliminación/anonimización GDPR.
Art. 17: Derecho de supresión (derecho al olvido).
Art. 30: Registro de actividades de tratamiento.
Retención: 5 años después de procesado (para demostrar cumplimiento).';

-- Habilitar RLS
ALTER TABLE public.solicitudes_eliminacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_eliminacion FORCE ROW LEVEL SECURITY;

-- Solo admins pueden gestionar solicitudes
DROP POLICY IF EXISTS se_admin ON public.solicitudes_eliminacion;
CREATE POLICY se_admin ON public.solicitudes_eliminacion
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Los usuarios pueden ver sus propias solicitudes
DROP POLICY IF EXISTS se_own ON public.solicitudes_eliminacion;
CREATE POLICY se_own ON public.solicitudes_eliminacion
    FOR SELECT TO authenticated
    USING (solicitado_por = auth.uid());

-- ============================================================================
-- SECCIÓN 2: TABLA DE CONSENTIMIENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consentimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sujeto del consentimiento
    tipo_sujeto TEXT NOT NULL CHECK (tipo_sujeto IN ('cliente', 'usuario')),
    sujeto_id UUID NOT NULL,
    email TEXT,
    
    -- Tipo de consentimiento (Art. 6 - Bases legales)
    tipo_consentimiento TEXT NOT NULL 
        CHECK (tipo_consentimiento IN (
            'tratamiento_basico',      -- Necesario para el contrato
            'comunicaciones_comerciales', -- Marketing
            'compartir_terceros',      -- Compartir con partners
            'perfilado',               -- Análisis y perfilado
            'transferencia_internacional', -- Transferencia fuera UE
            'cookies_analiticas',
            'cookies_marketing'
        )),
    
    -- Estado del consentimiento
    otorgado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_otorgamiento TIMESTAMPTZ,
    fecha_revocacion TIMESTAMPTZ,
    
    -- Evidencia del consentimiento
    metodo_obtencion TEXT CHECK (metodo_obtencion IN (
        'formulario_web', 'checkbox', 'double_opt_in', 'firma_contrato', 'api'
    )),
    ip_obtencion INET,
    evidencia_texto TEXT,  -- Texto exacto que aceptó
    
    -- Información de versión
    version_politica TEXT,  -- Versión de política de privacidad aceptada
    fecha_politica DATE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modificado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consentimientos_sujeto 
    ON public.consentimientos (sujeto_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_tipo 
    ON public.consentimientos (tipo_consentimiento);

ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cons_admin ON public.consentimientos;
CREATE POLICY cons_admin ON public.consentimientos
    FOR ALL TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS cons_own ON public.consentimientos;
CREATE POLICY cons_own ON public.consentimientos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_app 
            WHERE user_id = auth.uid() AND user_id = sujeto_id
        )
        OR EXISTS (
            -- Clientes no tienen user_id directo, acceso via contactos_cliente
            SELECT 1 FROM public.contactos_cliente cc
            WHERE cc.user_id = auth.uid() AND cc.cliente_id = sujeto_id
        )
    );

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN PARA VERIFICAR DEPENDENCIAS LEGALES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verificar_puede_eliminar_cliente(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_result JSONB;
    v_ultima_factura DATE;
    v_tiene_facturas BOOLEAN;
    v_tiene_contratos_activos BOOLEAN;
    v_tiene_deuda BOOLEAN;
    v_fecha_fin_retencion DATE;
    v_puede_eliminar_total BOOLEAN;
    v_puede_anonimizar BOOLEAN;
    v_cliente_existe BOOLEAN;
    v_motivos_bloqueo JSONB := '[]'::jsonb;
BEGIN
    -- Verificar que el cliente existe
    SELECT EXISTS (
        SELECT 1 FROM public.clientes WHERE id = p_cliente_id AND eliminado_en IS NULL
    ) INTO v_cliente_existe;
    
    IF NOT v_cliente_existe THEN
        RETURN jsonb_build_object(
            'puede_eliminar_total', FALSE,
            'puede_anonimizar', FALSE,
            'error', 'Cliente no encontrado o ya eliminado',
            'cliente_id', p_cliente_id
        );
    END IF;
    
    -- Verificar facturas (retención fiscal 10 años - Ley 58/2003)
    -- Nota: facturas.cliente_id referencia directamente a clientes
    SELECT 
        EXISTS (SELECT 1 FROM public.facturas f 
                WHERE f.cliente_id = p_cliente_id AND f.eliminado_en IS NULL),
        MAX(f.fecha_emision)
    INTO v_tiene_facturas, v_ultima_factura
    FROM public.facturas f
    WHERE f.cliente_id = p_cliente_id
      AND f.eliminado_en IS NULL;
    
    IF v_tiene_facturas AND v_ultima_factura IS NOT NULL THEN
        v_fecha_fin_retencion := v_ultima_factura + INTERVAL '10 years';
        
        IF v_fecha_fin_retencion > current_date THEN
            v_motivos_bloqueo := v_motivos_bloqueo || jsonb_build_object(
                'tipo', 'retencion_fiscal',
                'descripcion', 'Obligación de retención fiscal (10 años)',
                'referencia_legal', 'Ley 58/2003 General Tributaria',
                'fecha_fin_retencion', v_fecha_fin_retencion
            );
        END IF;
    END IF;
    
    -- Verificar contratos activos (via puntos_suministro)
    SELECT EXISTS (
        SELECT 1 FROM public.contratos c
        JOIN public.puntos_suministro ps ON ps.id = c.punto_id
        WHERE ps.cliente_id = p_cliente_id 
          AND c.eliminado_en IS NULL
          AND c.estado NOT IN ('vencido', 'resuelto')
    ) INTO v_tiene_contratos_activos;
    
    IF v_tiene_contratos_activos THEN
        v_motivos_bloqueo := v_motivos_bloqueo || jsonb_build_object(
            'tipo', 'contratos_activos',
            'descripcion', 'El cliente tiene contratos activos',
            'accion_requerida', 'Finalizar o cancelar contratos antes de eliminar'
        );
    END IF;
    
    -- Verificar deudas pendientes
    -- Nota: facturas tiene cliente_id directo
    SELECT EXISTS (
        SELECT 1 FROM public.facturas f
        WHERE f.cliente_id = p_cliente_id
          AND f.eliminado_en IS NULL
          AND f.estado IN ('borrador', 'emitida')  -- Estados reales del enum estado_factura
    ) INTO v_tiene_deuda;
    
    IF v_tiene_deuda THEN
        v_motivos_bloqueo := v_motivos_bloqueo || jsonb_build_object(
            'tipo', 'deuda_pendiente',
            'descripcion', 'El cliente tiene facturas pendientes de pago',
            'accion_requerida', 'Gestionar cobro o provisionar deuda antes de eliminar'
        );
    END IF;
    
    -- Determinar tipo de eliminación posible
    v_puede_eliminar_total := jsonb_array_length(v_motivos_bloqueo) = 0;
    v_puede_anonimizar := NOT v_tiene_contratos_activos AND NOT v_tiene_deuda;
    
    v_result := jsonb_build_object(
        'cliente_id', p_cliente_id,
        'puede_eliminar_total', v_puede_eliminar_total,
        'puede_anonimizar', v_puede_anonimizar,
        'tiene_facturas', v_tiene_facturas,
        'tiene_contratos_activos', v_tiene_contratos_activos,
        'tiene_deuda_pendiente', v_tiene_deuda,
        'fecha_ultima_factura', v_ultima_factura,
        'fecha_fin_retencion_fiscal', v_fecha_fin_retencion,
        'motivos_bloqueo', v_motivos_bloqueo,
        'recomendacion', CASE
            WHEN v_puede_eliminar_total THEN 'Eliminación total permitida'
            WHEN v_puede_anonimizar THEN 'Se recomienda anonimización parcial respetando obligaciones fiscales'
            ELSE 'No se puede procesar hasta resolver los bloqueos indicados'
        END,
        'verificado_en', current_timestamp
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.verificar_puede_eliminar_cliente IS 
'Verifica si un cliente puede ser eliminado y qué tipo de eliminación es posible.
Considera: retención fiscal (10 años), contratos activos, deudas.
GDPR Art. 17.3 - Excepciones al derecho de supresión.';

-- ============================================================================
-- SECCIÓN 4: FUNCIÓN DE ANONIMIZACIÓN PARCIAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anonimizar_cliente_parcial(
    p_cliente_id UUID,
    p_solicitud_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_cliente RECORD;
    v_registros_anonimizados JSONB := '{}'::jsonb;
    v_hash_id TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Verificar permisos
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden anonimizar datos'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener datos actuales del cliente
    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- Generar hash único para referenciar el cliente anonimizado
    v_hash_id := encode(extensions.digest(p_cliente_id::text || current_timestamp::text, 'sha256'), 'hex');
    
    -- Anonimizar datos personales del cliente
    -- Columnas reales de la tabla clientes: nombre, dni, cif, email_facturacion, numero_cuenta, telefonos, representante
    UPDATE public.clientes
    SET
        nombre = 'CLIENTE_ANONIMIZADO_' || substring(v_hash_id, 1, 8),
        dni = CASE WHEN dni IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END,
        cif = CASE WHEN cif IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END,
        email_facturacion = 'anonimizado_' || substring(v_hash_id, 1, 8) || '@eliminado.gdpr',
        telefonos = NULL,
        numero_cuenta = NULL,  -- IBAN/cuenta bancaria
        representante = CASE WHEN representante IS NOT NULL THEN 'ANONIMIZADO' ELSE NULL END,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = p_cliente_id;
    
    v_registros_anonimizados := v_registros_anonimizados || 
        jsonb_build_object('clientes', 1);
    
    -- Nota: contactos_cliente solo tiene cliente_id y user_id (relación muchos a muchos)
    -- No tiene datos personales que anonimizar, solo marcar como eliminado
    UPDATE public.contactos_cliente
    SET
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id
    WHERE cliente_id = p_cliente_id
      AND eliminado_en IS NULL;
    
    v_registros_anonimizados := v_registros_anonimizados || 
        jsonb_build_object('contactos_cliente', (SELECT COUNT(*) FROM public.contactos_cliente WHERE cliente_id = p_cliente_id));
    
    -- Anonimizar puntos de suministro (mantener CUPS por obligación legal)
    -- Columnas reales: direccion, titular, localidad, provincia
    UPDATE public.puntos_suministro
    SET
        direccion = 'DATOS ELIMINADOS POR SOLICITUD GDPR',
        titular = 'ANONIMIZADO',
        localidad = NULL,
        provincia = NULL,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE cliente_id = p_cliente_id;
    
    v_registros_anonimizados := v_registros_anonimizados || 
        jsonb_build_object('puntos_suministro', (SELECT COUNT(*) FROM public.puntos_suministro WHERE cliente_id = p_cliente_id));
    
    -- Soft delete de documentos (mantener metadatos para auditoría)
    -- Columnas reales: nombre_archivo (no 'nombre')
    UPDATE public.documentos
    SET
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        nombre_archivo = 'DOCUMENTO_ELIMINADO_GDPR'
    WHERE cliente_id = p_cliente_id
      AND eliminado_en IS NULL;
    
    v_registros_anonimizados := v_registros_anonimizados || 
        jsonb_build_object('documentos', (SELECT COUNT(*) FROM public.documentos WHERE cliente_id = p_cliente_id AND eliminado_por = v_user_id));
    
    -- Actualizar solicitud si se proporcionó
    IF p_solicitud_id IS NOT NULL THEN
        UPDATE public.solicitudes_eliminacion
        SET
            estado = 'completada',
            tipo_eliminacion = 'parcial',
            fecha_completado = current_timestamp,
            procesado_por = v_user_id,
            registros_anonimizados = v_registros_anonimizados,
            modificado_en = current_timestamp
        WHERE id = p_solicitud_id;
    END IF;
    
    -- Registrar en auditoría
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_ANONYMIZATION_PARTIAL', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'solicitud_id', p_solicitud_id,
            'registros_anonimizados', v_registros_anonimizados,
            'hash_referencia', v_hash_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'tipo', 'anonimizacion_parcial',
        'cliente_id', p_cliente_id,
        'hash_referencia', v_hash_id,
        'registros_anonimizados', v_registros_anonimizados,
        'procesado_en', current_timestamp,
        'nota', 'Datos personales eliminados. Datos fiscales conservados por obligación legal.'
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN DE ANONIMIZACIÓN TOTAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anonimizar_cliente_total(
    p_cliente_id UUID,
    p_solicitud_id UUID DEFAULT NULL,
    p_confirmar BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_verificacion JSONB;
    v_registros_eliminados JSONB := '{}'::jsonb;
    v_hash_id TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden eliminar datos'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar dependencias
    v_verificacion := public.verificar_puede_eliminar_cliente(p_cliente_id);
    
    IF NOT (v_verificacion->>'puede_eliminar_total')::BOOLEAN THEN
        IF NOT p_confirmar THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'No se puede realizar eliminación total',
                'verificacion', v_verificacion,
                'accion', 'Use anonimizar_cliente_parcial o resuelva los bloqueos'
            );
        ELSE
            -- Si se confirma, hacer anonimización parcial en su lugar
            RETURN public.anonimizar_cliente_parcial(p_cliente_id, p_solicitud_id);
        END IF;
    END IF;
    
    v_hash_id := encode(extensions.digest(p_cliente_id::text || 'total' || current_timestamp::text, 'sha256'), 'hex');
    
    -- Eliminar notificaciones
    DELETE FROM public.notificaciones WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('notificaciones', (SELECT COUNT(*) FROM public.notificaciones WHERE cliente_id = p_cliente_id));
    
    -- Eliminar comparativas
    DELETE FROM public.comparativas WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('comparativas', (SELECT COUNT(*) FROM public.comparativas WHERE cliente_id = p_cliente_id));
    
    -- Eliminar consumos (a través de puntos de suministro)
    DELETE FROM public.consumos 
    WHERE punto_id IN (SELECT id FROM public.puntos_suministro WHERE cliente_id = p_cliente_id);
    
    -- Eliminar documentos físicamente (ya validado que no hay retención)
    DELETE FROM public.documentos WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('documentos', (SELECT COUNT(*) FROM public.documentos WHERE cliente_id = p_cliente_id));
    
    -- Eliminar contratos (a través de puntos_suministro, ya verificado que no hay activos)
    DELETE FROM public.contratos 
    WHERE punto_id IN (SELECT id FROM public.puntos_suministro WHERE cliente_id = p_cliente_id);
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('contratos', 1);
    
    -- Eliminar puntos de suministro
    DELETE FROM public.puntos_suministro WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('puntos_suministro', (SELECT COUNT(*) FROM public.puntos_suministro WHERE cliente_id = p_cliente_id));
    
    -- Eliminar contactos
    DELETE FROM public.contactos_cliente WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('contactos_cliente', (SELECT COUNT(*) FROM public.contactos_cliente WHERE cliente_id = p_cliente_id));
    
    -- Eliminar asignaciones
    DELETE FROM public.asignaciones_comercial WHERE cliente_id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('asignaciones_comercial', (SELECT COUNT(*) FROM public.asignaciones_comercial WHERE cliente_id = p_cliente_id));
    
    -- Eliminar cliente
    DELETE FROM public.clientes WHERE id = p_cliente_id;
    v_registros_eliminados := v_registros_eliminados || 
        jsonb_build_object('clientes', 1);
    
    -- Actualizar solicitud
    IF p_solicitud_id IS NOT NULL THEN
        UPDATE public.solicitudes_eliminacion
        SET
            estado = 'completada',
            tipo_eliminacion = 'total',
            fecha_completado = current_timestamp,
            procesado_por = v_user_id,
            registros_eliminados = v_registros_eliminados,
            modificado_en = current_timestamp
        WHERE id = p_solicitud_id;
    END IF;
    
    -- Registrar en auditoría
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_DELETION_TOTAL', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'solicitud_id', p_solicitud_id,
            'registros_eliminados', v_registros_eliminados,
            'hash_referencia', v_hash_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'tipo', 'eliminacion_total',
        'cliente_id', p_cliente_id,
        'hash_referencia', v_hash_id,
        'registros_eliminados', v_registros_eliminados,
        'procesado_en', current_timestamp
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 6: FUNCIÓN DE ANONIMIZACIÓN DE COMERCIAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anonimizar_comercial(
    p_usuario_id UUID,
    p_solicitud_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_admin_id UUID;
    v_usuario RECORD;
    v_hash_id TEXT;
    v_registros JSONB := '{}'::jsonb;
BEGIN
    v_admin_id := auth.uid();
    
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden anonimizar usuarios'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT * INTO v_usuario FROM public.usuarios_app WHERE user_id = p_usuario_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuario no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- No permitir auto-anonimización
    IF v_usuario.user_id = v_admin_id THEN
        RAISE EXCEPTION 'No puede anonimizarse a sí mismo' USING ERRCODE = 'INVLD';
    END IF;
    
    v_hash_id := encode(extensions.digest(p_usuario_id::text || current_timestamp::text, 'sha256'), 'hex');
    
    -- Reasignar clientes a otro usuario o sistema
    -- Columna real: comercial_user_id (no comercial_id)
    UPDATE public.asignaciones_comercial
    SET comercial_user_id = v_admin_id  -- Reasignar al admin que ejecuta
    WHERE comercial_user_id = v_usuario.user_id;
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- Anonimizar datos del usuario
    -- Columnas reales: nombre, apellidos, email, telefono, avatar_url
    UPDATE public.usuarios_app
    SET
        nombre = 'USUARIO_ELIMINADO',
        apellidos = substring(v_hash_id, 1, 8),
        email = 'eliminado_' || substring(v_hash_id, 1, 8) || '@gdpr.eliminado',
        telefono = NULL,
        avatar_url = NULL,
        eliminado_en = current_timestamp,
        eliminado_por = v_admin_id,
        modificado_en = current_timestamp,
        modificado_por = v_admin_id
    WHERE user_id = p_usuario_id;
    
    -- Actualizar solicitud si existe
    IF p_solicitud_id IS NOT NULL THEN
        UPDATE public.solicitudes_eliminacion
        SET
            estado = 'completada',
            tipo_eliminacion = 'anonimizacion',
            fecha_completado = current_timestamp,
            procesado_por = v_admin_id,
            registros_anonimizados = jsonb_build_object(
                'usuarios_app', 1,
                'asignaciones_reasignadas', v_registros
            ),
            modificado_en = current_timestamp
        WHERE id = p_solicitud_id;
    END IF;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_USER_ANONYMIZATION', v_admin_id, current_timestamp, TRUE,
        jsonb_build_object(
            'usuario_anonimizado_id', p_usuario_id,
            'email_original', v_usuario.email,
            'solicitud_id', p_solicitud_id,
            'hash_referencia', v_hash_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'usuario_id', p_usuario_id,
        'hash_referencia', v_hash_id,
        'procesado_en', current_timestamp
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 7: FUNCIÓN PARA PROCESAR SOLICITUDES PENDIENTES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.procesar_anonimizaciones_pendientes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_solicitud RECORD;
    v_procesadas INT := 0;
    v_errores INT := 0;
    v_resultados JSONB := '[]'::jsonb;
    v_resultado JSONB;
BEGIN
    -- Verificar permisos
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden ejecutar esta función';
    END IF;
    
    -- Procesar solicitudes aprobadas que excedan el plazo (30 días desde solicitud)
    FOR v_solicitud IN
        SELECT * FROM public.solicitudes_eliminacion
        WHERE estado = 'aprobada'
          AND fecha_limite <= current_timestamp
        ORDER BY fecha_solicitud
        LIMIT 10  -- Procesar máximo 10 por ejecución
    LOOP
        BEGIN
            -- Marcar como procesando
            UPDATE public.solicitudes_eliminacion
            SET estado = 'procesando', modificado_en = current_timestamp
            WHERE id = v_solicitud.id;
            
            -- Procesar según tipo de sujeto
            IF v_solicitud.tipo_sujeto = 'cliente' THEN
                v_resultado := public.anonimizar_cliente_parcial(v_solicitud.sujeto_id, v_solicitud.id);
            ELSIF v_solicitud.tipo_sujeto IN ('comercial', 'usuario') THEN
                v_resultado := public.anonimizar_comercial(v_solicitud.sujeto_id, v_solicitud.id);
            END IF;
            
            v_procesadas := v_procesadas + 1;
            v_resultados := v_resultados || jsonb_build_object(
                'solicitud_id', v_solicitud.id,
                'resultado', v_resultado
            );
            
        EXCEPTION WHEN OTHERS THEN
            v_errores := v_errores + 1;
            
            UPDATE public.solicitudes_eliminacion
            SET 
                estado = 'error',
                notas_internas = COALESCE(notas_internas, '') || 
                    E'\nError ' || current_timestamp || ': ' || SQLERRM,
                modificado_en = current_timestamp
            WHERE id = v_solicitud.id;
            
            v_resultados := v_resultados || jsonb_build_object(
                'solicitud_id', v_solicitud.id,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'procesadas', v_procesadas,
        'errores', v_errores,
        'resultados', v_resultados,
        'ejecutado_en', current_timestamp
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 8: FUNCIÓN DE EXPORTACIÓN DE DATOS (PORTABILIDAD - Art. 20)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.exportar_datos_cliente(p_cliente_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_cliente RECORD;
    v_export JSONB;
BEGIN
    v_user_id := auth.uid();
    
    -- Verificar acceso: admin o usuario con acceso al cliente via contactos_cliente
    IF NOT (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.contactos_cliente cc
            WHERE cc.cliente_id = p_cliente_id AND cc.user_id = v_user_id
        )
    ) THEN
        RAISE EXCEPTION 'Acceso denegado' USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener datos del cliente
    SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- Construir exportación completa
    v_export := jsonb_build_object(
        'metadata', jsonb_build_object(
            'version', '1.0',
            'formato', 'GDPR-Export',
            'fecha_exportacion', current_timestamp,
            'solicitado_por', v_user_id,
            'referencia_legal', 'GDPR Art. 15 (Derecho de acceso) / Art. 20 (Portabilidad)'
        ),
        -- Columnas reales de clientes
        'datos_personales', jsonb_build_object(
            'tipo', v_cliente.tipo,
            'nombre', v_cliente.nombre,
            'dni', v_cliente.dni,
            'cif', v_cliente.cif,
            'email_facturacion', v_cliente.email_facturacion,
            'telefonos', v_cliente.telefonos,
            'numero_cuenta', v_cliente.numero_cuenta,
            'representante', v_cliente.representante,
            'estado', v_cliente.estado
        ),
        'puntos_suministro', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'cups', cups,
                'direccion', direccion,
                'titular', titular,
                'localidad', localidad,
                'provincia', provincia,
                'tarifa_acceso', tarifa_acceso,
                'potencia_contratada_kw', potencia_contratada_kw,
                'consumo_anual_kwh', consumo_anual_kwh,
                'tipo_factura', tipo_factura
            )), '[]'::jsonb)
            FROM public.puntos_suministro
            WHERE cliente_id = p_cliente_id AND eliminado_en IS NULL
        ),
        'contratos', (
            -- Contratos via puntos_suministro
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'oferta', c.oferta,
                'fecha_inicio', c.fecha_inicio,
                'fecha_fin', c.fecha_fin,
                'estado', c.estado,
                'cups', ps.cups
            )), '[]'::jsonb)
            FROM public.contratos c
            JOIN public.puntos_suministro ps ON ps.id = c.punto_id
            WHERE ps.cliente_id = p_cliente_id AND c.eliminado_en IS NULL
        ),
        'usuarios_contacto', (
            -- contactos_cliente solo tiene user_id, obtener datos del usuario
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'nombre', u.nombre,
                'apellidos', u.apellidos,
                'email', u.email,
                'telefono', u.telefono
            )), '[]'::jsonb)
            FROM public.contactos_cliente cc
            JOIN public.usuarios_app u ON u.user_id = cc.user_id
            WHERE cc.cliente_id = p_cliente_id AND cc.eliminado_en IS NULL
        ),
        'consentimientos', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'tipo', tipo_consentimiento,
                'otorgado', otorgado,
                'fecha', fecha_otorgamiento
            )), '[]'::jsonb)
            FROM public.consentimientos
            WHERE sujeto_id = p_cliente_id
        ),
        'historial_actividad', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'tabla', table_name,
                'accion', action,
                'fecha', action_tstamp_tx
            ) ORDER BY action_tstamp_tx DESC), '[]'::jsonb)
            FROM audit.logged_actions
            WHERE (old_data->>'id')::UUID = p_cliente_id
               OR (new_data->>'id')::UUID = p_cliente_id
            LIMIT 100
        )
    );
    
    -- Registrar exportación
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_DATA_EXPORT', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'cliente_id', p_cliente_id,
            'tipo', 'portabilidad'
        )
    );
    
    RETURN v_export;
END;
$$;

-- ============================================================================
-- SECCIÓN 9: VISTA DE SOLICITUDES PARA DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW public.vista_solicitudes_eliminacion AS
SELECT 
    se.id,
    se.tipo_sujeto,
    se.nombre_sujeto,
    se.email_sujeto,
    se.fecha_solicitud,
    se.fecha_limite,
    se.estado,
    se.tipo_eliminacion,
    se.motivo_rechazo,
    CASE 
        WHEN se.fecha_limite < current_timestamp AND se.estado = 'pendiente' 
        THEN TRUE 
        ELSE FALSE 
    END AS vencida,
    current_timestamp - se.fecha_solicitud AS tiempo_transcurrido,
    se.fecha_limite - current_timestamp AS tiempo_restante,
    u_revisor.email AS revisado_por_email,
    u_procesador.email AS procesado_por_email
FROM public.solicitudes_eliminacion se
LEFT JOIN public.usuarios_app u_revisor ON u_revisor.user_id = se.revisado_por
LEFT JOIN public.usuarios_app u_procesador ON u_procesador.user_id = se.procesado_por
ORDER BY 
    CASE se.estado
        WHEN 'pendiente' THEN 1
        WHEN 'en_revision' THEN 2
        WHEN 'aprobada' THEN 3
        WHEN 'procesando' THEN 4
        ELSE 5
    END,
    se.fecha_limite;

-- ============================================================================
-- SECCIÓN 10: FUNCIÓN PARA CREAR SOLICITUD DE ELIMINACIÓN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.crear_solicitud_eliminacion(
    p_tipo_sujeto TEXT,
    p_sujeto_id UUID,
    p_motivo TEXT DEFAULT NULL,
    p_metodo TEXT DEFAULT 'api'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_sujeto RECORD;
    v_solicitud_id UUID;
    v_email TEXT;
    v_nombre TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Validar tipo
    IF p_tipo_sujeto NOT IN ('cliente', 'comercial', 'usuario') THEN
        RAISE EXCEPTION 'Tipo de sujeto inválido' USING ERRCODE = 'INVLD';
    END IF;
    
    -- Obtener datos del sujeto
    IF p_tipo_sujeto = 'cliente' THEN
        -- clientes tiene email_facturacion, no email
        SELECT nombre, email_facturacion INTO v_nombre, v_email
        FROM public.clientes WHERE id = p_sujeto_id;
    ELSE
        -- usuarios_app usa user_id, no id
        SELECT nombre, email INTO v_nombre, v_email
        FROM public.usuarios_app WHERE user_id = p_sujeto_id;
    END IF;
    
    IF v_nombre IS NULL THEN
        RAISE EXCEPTION 'Sujeto no encontrado' USING ERRCODE = 'NTFND';
    END IF;
    
    -- Verificar si ya existe solicitud activa
    IF EXISTS (
        SELECT 1 FROM public.solicitudes_eliminacion
        WHERE sujeto_id = p_sujeto_id
          AND estado NOT IN ('completada', 'rechazada')
    ) THEN
        RAISE EXCEPTION 'Ya existe una solicitud activa para este sujeto';
    END IF;
    
    -- Crear solicitud
    INSERT INTO public.solicitudes_eliminacion (
        tipo_sujeto, sujeto_id, email_sujeto, nombre_sujeto,
        motivo, metodo_solicitud, solicitado_por,
        fecha_limite
    ) VALUES (
        p_tipo_sujeto, p_sujeto_id, v_email, v_nombre,
        p_motivo, p_metodo, v_user_id,
        current_timestamp + INTERVAL '30 days'  -- GDPR: 30 días para responder
    )
    RETURNING id INTO v_solicitud_id;
    
    -- Registrar evento
    INSERT INTO audit.security_events (
        event_type, user_id, email, event_timestamp, success, metadata
    ) VALUES (
        'GDPR_DELETION_REQUEST_CREATED', v_user_id, v_email, current_timestamp, TRUE,
        jsonb_build_object(
            'solicitud_id', v_solicitud_id,
            'tipo_sujeto', p_tipo_sujeto,
            'sujeto_id', p_sujeto_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'solicitud_id', v_solicitud_id,
        'fecha_limite', current_timestamp + INTERVAL '30 days',
        'mensaje', 'Solicitud creada. Será procesada en un plazo máximo de 30 días.'
    );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.crear_solicitud_eliminacion TO authenticated;
GRANT EXECUTE ON FUNCTION public.exportar_datos_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_puede_eliminar_cliente TO authenticated;

-- Solo admins para funciones de anonimización
GRANT EXECUTE ON FUNCTION public.anonimizar_cliente_parcial TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonimizar_cliente_total TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonimizar_comercial TO authenticated;
GRANT EXECUTE ON FUNCTION public.procesar_anonimizaciones_pendientes TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('solicitudes_eliminacion', 'consentimientos');

-- 2. Verificar funciones GDPR
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%anonimizar%' OR routine_name LIKE '%gdpr%' OR routine_name LIKE '%eliminar%';

-- 3. Probar verificación de cliente
SELECT public.verificar_puede_eliminar_cliente('uuid-de-cliente-test');

-- 4. Ver vista de solicitudes
SELECT * FROM public.vista_solicitudes_eliminacion;
*/
