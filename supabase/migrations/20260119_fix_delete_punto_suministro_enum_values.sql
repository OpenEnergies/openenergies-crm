-- Corregir la función delete_punto_suministro que usaba valores de enum inválidos
-- El enum estado_contrato NO tiene 'vencido' ni 'resuelto'
-- Los estados que indican contrato finalizado/inactivo son: 'Baja', 'Desiste', 'Standby'

CREATE OR REPLACE FUNCTION public.delete_punto_suministro(punto_id_to_delete uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_cliente_id UUID;
    v_contratos_activos INT;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autenticado: esta operación requiere autenticación'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    SELECT rol::TEXT INTO v_user_role
    FROM public.usuarios_app
    WHERE user_id = v_user_id
      AND eliminado_en IS NULL;
    
    IF v_user_role NOT IN ('administrador', 'comercial') THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Rol insuficiente para eliminar punto de suministro',
            jsonb_build_object('punto_id', punto_id_to_delete, 'user_role', v_user_role)
        );
        
        RAISE EXCEPTION 'Acceso denegado: rol % no puede eliminar puntos de suministro', v_user_role
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Obtener cliente_id del punto
    SELECT cliente_id INTO v_cliente_id
    FROM public.puntos_suministro
    WHERE id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Punto de suministro no encontrado o ya eliminado'
            USING ERRCODE = 'NTFND';
    END IF;
    
    -- Verificar acceso al cliente
    IF v_user_role = 'comercial' AND NOT public.can_access_cliente(v_cliente_id) THEN
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'UNAUTHORIZED_DELETE_ATTEMPT', v_user_id, current_timestamp, FALSE,
            'Comercial intentó eliminar punto de cliente no asignado',
            jsonb_build_object('punto_id', punto_id_to_delete, 'cliente_id', v_cliente_id)
        );
        
        RAISE EXCEPTION 'Acceso denegado: no tiene permiso sobre este cliente'
            USING ERRCODE = 'AUTHZ';
    END IF;
    
    -- Verificar si hay contratos activos vinculados
    -- Estados finalizados/inactivos: 'Baja', 'Desiste', 'Standby'
    -- Resto de estados se consideran "activos" para esta validación
    SELECT COUNT(*) INTO v_contratos_activos
    FROM public.contratos
    WHERE punto_id = punto_id_to_delete
      AND eliminado_en IS NULL
      AND estado NOT IN ('Baja'::estado_contrato, 'Desiste'::estado_contrato, 'Standby'::estado_contrato);
    
    IF v_contratos_activos > 0 THEN
        RAISE EXCEPTION 'No se puede eliminar: hay % contratos activos vinculados', v_contratos_activos
            USING ERRCODE = 'DPNDY';
    END IF;
    
    -- Soft delete del punto
    UPDATE public.puntos_suministro
    SET 
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    -- Soft delete de contratos finalizados vinculados
    UPDATE public.contratos
    SET 
        eliminado_en = current_timestamp,
        eliminado_por = v_user_id,
        modificado_en = current_timestamp,
        modificado_por = v_user_id
    WHERE punto_id = punto_id_to_delete
      AND eliminado_en IS NULL;
    
    INSERT INTO audit.security_events (
        event_type, user_id, event_timestamp, success, metadata
    ) VALUES (
        'SUPPLY_POINT_SOFT_DELETE', v_user_id, current_timestamp, TRUE,
        jsonb_build_object(
            'punto_id', punto_id_to_delete,
            'cliente_id', v_cliente_id,
            'user_role', v_user_role
        )
    );
    
    v_result := json_build_object(
        'success', TRUE,
        'message', 'Punto de suministro marcado como eliminado',
        'punto_id', punto_id_to_delete
    );
    
    RETURN v_result;
END;
$function$;
