-- ============================================================================
-- MIGRACIÓN: Corregir detección de soft delete en registro de actividad
-- Fecha: 2026-01-22
-- 
-- PROBLEMA:
-- Cuando se elimina un registro (soft delete), se actualiza la columna 
-- 'eliminado_en' en lugar de hacer un DELETE real. Esto causa que el trigger
-- de actividad registre el evento como "edición" en lugar de "eliminación".
--
-- SOLUCIÓN:
-- Modificar la función fn_registrar_actividad para detectar cuando un UPDATE
-- es realmente un soft delete (cuando eliminado_en cambia de NULL a un valor).
-- ============================================================================

-- Actualizar la función de registro de actividad para detectar soft deletes
CREATE OR REPLACE FUNCTION public.fn_registrar_actividad()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_cliente_id UUID;
    v_empresa_id UUID;
    v_entidad_tipo entidad_tipo_log;
    v_tipo_evento tipo_evento_log;
    v_entidad_id UUID;
    v_detalles JSONB;
    v_metadata JSONB;
    v_metodo_cliente TEXT;
    v_record RECORD;
    v_old_json JSONB;
    v_new_json JSONB;
    v_is_soft_delete BOOLEAN := FALSE;
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
    
    -- Detectar si es un soft delete (UPDATE que establece eliminado_en)
    -- Esto aplica cuando: 
    --   1. Es un UPDATE
    --   2. OLD.eliminado_en era NULL
    --   3. NEW.eliminado_en tiene un valor (no es NULL)
    IF TG_OP = 'UPDATE' THEN
        -- Verificar si la tabla tiene la columna eliminado_en y si es un soft delete
        BEGIN
            IF OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL THEN
                v_is_soft_delete := TRUE;
            END IF;
        EXCEPTION WHEN undefined_column THEN
            -- La tabla no tiene columna eliminado_en, no es soft delete
            v_is_soft_delete := FALSE;
        END;
    END IF;
    
    -- Determinar el tipo de evento según la operación
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_tipo_evento := 'creacion';
            v_record := NEW;
            v_entidad_id := NEW.id;
        WHEN 'UPDATE' THEN
            -- Si es soft delete, registrar como eliminación
            IF v_is_soft_delete THEN
                v_tipo_evento := 'eliminacion';
            ELSE
                v_tipo_evento := 'edicion';
            END IF;
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
    
    -- Resolver empresa_id (comercializadora) basado en el tipo de entidad
    CASE v_entidad_tipo
        WHEN 'punto' THEN
            -- Puntos tienen current_comercializadora_id
            IF TG_OP = 'DELETE' THEN
                v_empresa_id := OLD.current_comercializadora_id;
            ELSE
                v_empresa_id := NEW.current_comercializadora_id;
            END IF;
            
        WHEN 'contrato' THEN
            -- Contratos tienen comercializadora_id
            IF TG_OP = 'DELETE' THEN
                v_empresa_id := OLD.comercializadora_id;
            ELSE
                v_empresa_id := NEW.comercializadora_id;
            END IF;
            
        WHEN 'factura_cliente' THEN
            -- Facturas clientes tienen comercializadora_id
            IF TG_OP = 'DELETE' THEN
                v_empresa_id := OLD.comercializadora_id;
            ELSE
                v_empresa_id := NEW.comercializadora_id;
            END IF;
            
        ELSE
            -- Para otras entidades, intentar obtener empresa_id a través de punto_id o contrato_id
            IF v_record IS NOT NULL THEN
                -- Intentar via punto_id
                IF v_record.punto_id IS NOT NULL THEN
                    SELECT ps.current_comercializadora_id INTO v_empresa_id
                    FROM puntos_suministro ps
                    WHERE ps.id = v_record.punto_id;
                END IF;
                
                -- Si no se encontró, intentar via contrato_id
                IF v_empresa_id IS NULL AND v_record.contrato_id IS NOT NULL THEN
                    SELECT c.comercializadora_id INTO v_empresa_id
                    FROM contratos c
                    WHERE c.id = v_record.contrato_id;
                END IF;
            END IF;
    END CASE;
    
    -- Construir detalles JSON según la operación
    -- Para soft delete, usar el mismo formato que DELETE real
    IF TG_OP = 'INSERT' THEN
        v_new_json := to_jsonb(NEW);
        v_new_json := v_new_json - 'numero_cuenta';
        v_detalles := jsonb_build_object('new', v_new_json);
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);
        v_old_json := v_old_json - 'numero_cuenta';
        v_new_json := v_new_json - 'numero_cuenta';
        
        IF v_is_soft_delete THEN
            -- Para soft delete, solo guardamos el estado anterior (como en DELETE)
            v_detalles := jsonb_build_object('old', v_old_json);
        ELSE
            -- Para edición normal, guardamos old y new
            v_detalles := jsonb_build_object('old', v_old_json, 'new', v_new_json);
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_old_json := to_jsonb(OLD);
        v_old_json := v_old_json - 'numero_cuenta';
        v_detalles := jsonb_build_object('old', v_old_json);
    END IF;
    
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
        empresa_id,
        user_id,
        tipo_evento,
        entidad_tipo,
        entidad_id,
        detalles_json,
        metadata_usuario
    ) VALUES (
        v_cliente_id,
        v_empresa_id,
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
$function$;

-- Añadir comentario a la función para documentar el comportamiento
COMMENT ON FUNCTION public.fn_registrar_actividad() IS 
'Función de trigger para registrar actividad de cambios en entidades.
Detecta soft deletes automáticamente cuando eliminado_en cambia de NULL a un valor,
registrando el evento como "eliminacion" en lugar de "edicion".
Soporta tablas con y sin columna eliminado_en.';
