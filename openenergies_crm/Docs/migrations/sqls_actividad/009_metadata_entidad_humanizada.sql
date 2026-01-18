-- ============================================================================
-- 009_metadata_entidad_humanizada.sql
-- Sistema de Auditoría y Actividad - Metadatos Legibles para Humanos
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- ============================================================================
-- NUEVA COLUMNA PARA METADATOS HUMANOS
-- ============================================================================

-- Columna metadatos_entidad: contiene información legible del evento
-- Ejemplo: { "cliente_nombre": "Empresa X", "cups": "ES00123...", "direccion": "..." }
ALTER TABLE actividad_log 
ADD COLUMN IF NOT EXISTS metadatos_entidad JSONB DEFAULT '{}'::jsonb;

-- Índice GIN para búsquedas en metadatos
CREATE INDEX IF NOT EXISTS idx_actividad_log_metadatos_entidad
ON actividad_log USING GIN (metadatos_entidad);

COMMENT ON COLUMN actividad_log.metadatos_entidad IS 'Metadatos legibles de la entidad en el momento del evento: cliente_nombre, cups, direccion, comercializadora_nombre, etc.';

-- ============================================================================
-- FUNCIÓN TRIGGER MEJORADA CON METADATOS HUMANOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_registrar_actividad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
    v_punto_id UUID;
    v_contrato_id UUID;
    v_entidad_tipo entidad_tipo_log;
    v_tipo_evento tipo_evento_log;
    v_entidad_id UUID;
    v_detalles JSONB;
    v_metadata JSONB;
    v_metadatos_entidad JSONB;
    v_metodo_cliente TEXT;
    v_record RECORD;
    v_old_json JSONB;
    v_new_json JSONB;
    -- Variables para metadatos humanos
    v_cliente_nombre TEXT;
    v_cups TEXT;
    v_direccion TEXT;
    v_comercializadora_nombre TEXT;
BEGIN
    -- Obtener el usuario actual desde auth.uid()
    v_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, salir sin hacer nada
    IF v_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Obtener parámetros del trigger
    v_entidad_tipo := TG_ARGV[0]::entidad_tipo_log;
    v_metodo_cliente := COALESCE(TG_ARGV[1], 'direct');
    
    -- Determinar el tipo de evento según la operación
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_tipo_evento := 'creacion';
            v_record := NEW;
            v_entidad_id := NEW.id;
        WHEN 'UPDATE' THEN
            v_tipo_evento := 'edicion';
            v_record := NEW;
            v_entidad_id := NEW.id;
        WHEN 'DELETE' THEN
            v_tipo_evento := 'eliminacion';
            v_record := OLD;
            v_entidad_id := OLD.id;
    END CASE;
    
    -- Inicializar
    v_punto_id := NULL;
    v_contrato_id := NULL;
    v_metadatos_entidad := '{}'::jsonb;
    
    -- Resolver IDs y capturar metadatos humanos según la entidad
    CASE v_entidad_tipo
        WHEN 'cliente' THEN
            v_cliente_id := v_entidad_id;
            v_cliente_nombre := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.nombre 
                ELSE NEW.nombre 
            END;
            v_metadatos_entidad := jsonb_build_object(
                'cliente_nombre', v_cliente_nombre
            );
            
        WHEN 'punto' THEN
            v_punto_id := v_entidad_id;
            v_cliente_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.cliente_id 
                ELSE NEW.cliente_id 
            END;
            v_cups := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.cups 
                ELSE NEW.cups 
            END;
            v_direccion := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.direccion_sum 
                ELSE NEW.direccion_sum 
            END;
            -- Obtener nombre del cliente
            SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = v_cliente_id;
            v_metadatos_entidad := jsonb_build_object(
                'cliente_nombre', v_cliente_nombre,
                'cups', v_cups,
                'direccion', v_direccion
            );
            
        WHEN 'contrato' THEN
            v_contrato_id := v_entidad_id;
            v_punto_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.punto_id 
                ELSE NEW.punto_id 
            END;
            -- Obtener CUPS, dirección y cliente del punto
            SELECT ps.cups, ps.direccion_sum, ps.cliente_id, c.nombre
            INTO v_cups, v_direccion, v_cliente_id, v_cliente_nombre
            FROM puntos_suministro ps
            LEFT JOIN clientes c ON c.id = ps.cliente_id
            WHERE ps.id = v_punto_id;
            -- Obtener nombre de la comercializadora
            SELECT e.nombre INTO v_comercializadora_nombre
            FROM empresas e
            WHERE e.id = CASE TG_OP 
                WHEN 'DELETE' THEN OLD.comercializadora_id 
                ELSE NEW.comercializadora_id 
            END;
            v_metadatos_entidad := jsonb_build_object(
                'cliente_nombre', v_cliente_nombre,
                'cups', v_cups,
                'direccion', v_direccion,
                'comercializadora_nombre', v_comercializadora_nombre
            );
            
        WHEN 'documento' THEN
            -- Resolver en cascada
            IF TG_OP = 'DELETE' THEN
                v_cliente_id := OLD.cliente_id;
                v_punto_id := OLD.punto_id;
                v_contrato_id := OLD.contrato_id;
            ELSE
                v_cliente_id := NEW.cliente_id;
                v_punto_id := NEW.punto_id;
                v_contrato_id := NEW.contrato_id;
            END IF;
            -- Obtener metadatos del punto si existe
            IF v_punto_id IS NOT NULL THEN
                SELECT ps.cups, ps.direccion_sum, ps.cliente_id
                INTO v_cups, v_direccion, v_cliente_id
                FROM puntos_suministro ps WHERE ps.id = v_punto_id;
            END IF;
            -- Obtener nombre del cliente
            IF v_cliente_id IS NOT NULL THEN
                SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = v_cliente_id;
            END IF;
            v_metadatos_entidad := jsonb_build_object(
                'cliente_nombre', v_cliente_nombre,
                'cups', v_cups,
                'direccion', v_direccion
            );
            
        WHEN 'factura', 'factura_cliente' THEN
            v_cliente_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.cliente_id 
                ELSE NEW.cliente_id 
            END;
            v_punto_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.punto_id 
                ELSE NEW.punto_id 
            END;
            -- Obtener CUPS del punto
            IF v_punto_id IS NOT NULL THEN
                SELECT cups, direccion_sum INTO v_cups, v_direccion
                FROM puntos_suministro WHERE id = v_punto_id;
            END IF;
            -- Obtener nombre del cliente
            IF v_cliente_id IS NOT NULL THEN
                SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = v_cliente_id;
            END IF;
            -- Obtener comercializadora si existe
            IF TG_OP != 'DELETE' AND NEW.comercializadora_id IS NOT NULL THEN
                SELECT nombre INTO v_comercializadora_nombre FROM empresas WHERE id = NEW.comercializadora_id;
            END IF;
            v_metadatos_entidad := jsonb_build_object(
                'cliente_nombre', v_cliente_nombre,
                'cups', v_cups,
                'direccion', v_direccion,
                'comercializadora_nombre', v_comercializadora_nombre
            );
            
        ELSE
            -- Fallback genérico
            v_cliente_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.cliente_id 
                ELSE NEW.cliente_id 
            END;
            IF v_cliente_id IS NOT NULL THEN
                SELECT nombre INTO v_cliente_nombre FROM clientes WHERE id = v_cliente_id;
                v_metadatos_entidad := jsonb_build_object('cliente_nombre', v_cliente_nombre);
            END IF;
    END CASE;
    
    -- Construir detalles JSON según la operación
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_new_json := to_jsonb(NEW);
            v_new_json := v_new_json - 'numero_cuenta';
            v_detalles := jsonb_build_object('new', v_new_json);
            
        WHEN 'UPDATE' THEN
            v_old_json := to_jsonb(OLD);
            v_new_json := to_jsonb(NEW);
            v_old_json := v_old_json - 'numero_cuenta';
            v_new_json := v_new_json - 'numero_cuenta';
            v_detalles := jsonb_build_object('old', v_old_json, 'new', v_new_json);
            
        WHEN 'DELETE' THEN
            v_old_json := to_jsonb(OLD);
            v_old_json := v_old_json - 'numero_cuenta';
            v_detalles := jsonb_build_object('old', v_old_json);
    END CASE;
    
    -- Obtener metadata del usuario
    SELECT jsonb_build_object(
        'nombre', COALESCE(ua.nombre, 'Usuario'),
        'apellidos', COALESCE(ua.apellidos, ''),
        'email', COALESCE(ua.email, '')
    ) INTO v_metadata
    FROM usuarios_app ua
    WHERE ua.user_id = v_user_id;
    
    IF v_metadata IS NULL THEN
        v_metadata := jsonb_build_object(
            'nombre', 'Sistema',
            'apellidos', '',
            'email', ''
        );
    END IF;
    
    -- Insertar el registro con metadatos humanos
    INSERT INTO actividad_log (
        cliente_id,
        punto_id,
        contrato_id,
        user_id,
        tipo_evento,
        entidad_tipo,
        entidad_id,
        detalles_json,
        metadata_usuario,
        metadatos_entidad
    ) VALUES (
        v_cliente_id,
        v_punto_id,
        v_contrato_id,
        v_user_id,
        v_tipo_evento,
        v_entidad_tipo,
        v_entidad_id,
        v_detalles,
        v_metadata,
        v_metadatos_entidad
    );
    
    RETURN COALESCE(NEW, OLD);
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_registrar_actividad] Error: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_registrar_actividad() IS 'Función trigger con captura de metadatos humanos (nombre cliente, CUPS, dirección) para evitar mostrar UUIDs.';
