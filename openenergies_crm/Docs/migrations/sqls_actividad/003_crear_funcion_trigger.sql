-- ============================================================================
-- 003_crear_funcion_trigger.sql
-- Sistema de Auditoría y Actividad - Función Trigger Genérica
-- Proyecto: Open Energies CRM
-- Fecha: 2026-01-18
-- ============================================================================

-- Función genérica para registrar eventos de auditoría
-- Se invoca desde triggers AFTER INSERT/UPDATE/DELETE
-- Parámetros via TG_ARGV:
--   [0] = entidad_tipo (cliente, punto, contrato, documento, factura, factura_cliente)
--   [1] = método para obtener cliente_id ('direct', 'via_punto', 'via_contrato', 'column:<nombre>')
CREATE OR REPLACE FUNCTION fn_registrar_actividad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
    v_entidad_tipo entidad_tipo_log;
    v_tipo_evento tipo_evento_log;
    v_entidad_id UUID;
    v_detalles JSONB;
    v_metadata JSONB;
    v_metodo_cliente TEXT;
    v_record RECORD;
    v_old_json JSONB;
    v_new_json JSONB;
BEGIN
    -- Obtener el usuario actual desde auth.uid()
    v_user_id := auth.uid();
    
    -- Si no hay usuario autenticado, salir sin hacer nada (evita errores en migraciones)
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
    
    -- Resolver cliente_id según el método especificado
    CASE v_metodo_cliente
        WHEN 'direct' THEN
            -- La tabla tiene cliente_id directamente (clientes usa su propio id)
            IF v_entidad_tipo = 'cliente' THEN
                v_cliente_id := v_entidad_id;
            ELSE
                v_cliente_id := CASE TG_OP 
                    WHEN 'DELETE' THEN OLD.cliente_id 
                    ELSE NEW.cliente_id 
                END;
            END IF;
            
        WHEN 'via_punto' THEN
            -- Obtener cliente_id a través de punto_id (ej: contratos)
            IF TG_OP = 'DELETE' THEN
                SELECT ps.cliente_id INTO v_cliente_id
                FROM puntos_suministro ps
                WHERE ps.id = OLD.punto_id;
            ELSE
                SELECT ps.cliente_id INTO v_cliente_id
                FROM puntos_suministro ps
                WHERE ps.id = NEW.punto_id;
            END IF;
            
        WHEN 'via_contrato' THEN
            -- Obtener cliente_id a través de contrato_id (si aplica)
            IF TG_OP = 'DELETE' THEN
                SELECT ps.cliente_id INTO v_cliente_id
                FROM contratos c
                JOIN puntos_suministro ps ON ps.id = c.punto_id
                WHERE c.id = OLD.contrato_id;
            ELSE
                SELECT ps.cliente_id INTO v_cliente_id
                FROM contratos c
                JOIN puntos_suministro ps ON ps.id = c.punto_id
                WHERE c.id = NEW.contrato_id;
            END IF;
            
        WHEN 'documento_cascada' THEN
            -- Documentos: intentar resolver cliente_id en cascada
            IF TG_OP = 'DELETE' THEN
                v_cliente_id := OLD.cliente_id;
                IF v_cliente_id IS NULL AND OLD.punto_id IS NOT NULL THEN
                    SELECT ps.cliente_id INTO v_cliente_id
                    FROM puntos_suministro ps WHERE ps.id = OLD.punto_id;
                END IF;
                IF v_cliente_id IS NULL AND OLD.contrato_id IS NOT NULL THEN
                    SELECT ps.cliente_id INTO v_cliente_id
                    FROM contratos c
                    JOIN puntos_suministro ps ON ps.id = c.punto_id
                    WHERE c.id = OLD.contrato_id;
                END IF;
            ELSE
                v_cliente_id := NEW.cliente_id;
                IF v_cliente_id IS NULL AND NEW.punto_id IS NOT NULL THEN
                    SELECT ps.cliente_id INTO v_cliente_id
                    FROM puntos_suministro ps WHERE ps.id = NEW.punto_id;
                END IF;
                IF v_cliente_id IS NULL AND NEW.contrato_id IS NOT NULL THEN
                    SELECT ps.cliente_id INTO v_cliente_id
                    FROM contratos c
                    JOIN puntos_suministro ps ON ps.id = c.punto_id
                    WHERE c.id = NEW.contrato_id;
                END IF;
            END IF;
            
        ELSE
            -- Fallback: intentar obtener cliente_id directamente
            v_cliente_id := CASE TG_OP 
                WHEN 'DELETE' THEN OLD.cliente_id 
                ELSE NEW.cliente_id 
            END;
    END CASE;
    
    -- Construir detalles JSON según la operación
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_new_json := to_jsonb(NEW);
            -- Excluir campos sensibles si existen
            v_new_json := v_new_json - 'numero_cuenta';
            v_detalles := jsonb_build_object('new', v_new_json);
            
        WHEN 'UPDATE' THEN
            v_old_json := to_jsonb(OLD);
            v_new_json := to_jsonb(NEW);
            -- Excluir campos sensibles
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
    
    -- Si no se encuentra el usuario, usar valores por defecto
    IF v_metadata IS NULL THEN
        v_metadata := jsonb_build_object(
            'nombre', 'Sistema',
            'apellidos', '',
            'email', ''
        );
    END IF;
    
    -- Insertar el registro de actividad
    INSERT INTO actividad_log (
        cliente_id,
        user_id,
        tipo_evento,
        entidad_tipo,
        entidad_id,
        detalles_json,
        metadata_usuario
    ) VALUES (
        v_cliente_id,
        v_user_id,
        v_tipo_evento,
        v_entidad_tipo,
        v_entidad_id,
        v_detalles,
        v_metadata
    );
    
    -- Retornar el registro apropiado
    RETURN COALESCE(NEW, OLD);
    
EXCEPTION WHEN OTHERS THEN
    -- En caso de error, loguear pero no fallar la operación original
    RAISE WARNING '[fn_registrar_actividad] Error al registrar actividad: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION fn_registrar_actividad() IS 'Función trigger genérica para registrar eventos de auditoría en actividad_log. Usa TG_ARGV para recibir configuración.';
