CREATE OR REPLACE FUNCTION public.get_auditoria_energetica_data(p_cliente_id uuid, p_fecha_inicio date, p_fecha_fin date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
    v_resumen_tarifas JSONB;
    v_inventario JSONB;
    v_analisis_potencias JSONB;
    v_facturacion_puntos JSONB;
BEGIN
    -- RLS se aplica automáticamente en las tablas subyacentes

    -- =====================================================
    -- BLOQUE A: Resumen Ejecutivo por Tarifa
    -- =====================================================
    WITH facturas_periodo AS (
        SELECT 
            fc.tarifa,
            date_trunc('month', fc.fecha_emision)::date AS mes,
            fc.consumo_kwh,
            fc.total,
            fc.punto_id,
            fc.potencia_kw_max
        FROM facturacion_clientes fc
        WHERE fc.cliente_id = p_cliente_id
          AND fc.fecha_emision >= p_fecha_inicio
          AND fc.fecha_emision <= p_fecha_fin
          AND fc.eliminado_en IS NULL
    ),
    resumen_mensual AS (
        SELECT 
            tarifa,
            mes,
            SUM(consumo_kwh)::NUMERIC(12,2) AS consumo_total,
            SUM(total)::NUMERIC(12,2) AS coste_total,
            CASE 
                WHEN SUM(consumo_kwh) > 0 
                THEN ROUND((SUM(total) / SUM(consumo_kwh))::NUMERIC, 4)
                ELSE 0 
            END AS precio_medio_kwh,
            COUNT(DISTINCT punto_id)::INTEGER AS puntos_activos,
            MAX(potencia_kw_max)::NUMERIC(10,2) AS potencia_maxima_registrada
        FROM facturas_periodo
        GROUP BY tarifa, mes
        ORDER BY tarifa, mes
    ),
    agrupado_por_tarifa AS (
        SELECT 
            tarifa,
            jsonb_agg(
                jsonb_build_object(
                    'mes', to_char(mes, 'YYYY-MM'),
                    'mes_nombre', to_char(mes, 'TMMonth YYYY'),
                    'consumo_total', consumo_total,
                    'coste_total', coste_total,
                    'precio_medio_kwh', precio_medio_kwh,
                    'puntos_activos', puntos_activos,
                    'potencia_maxima_registrada', potencia_maxima_registrada
                ) ORDER BY mes
            ) AS meses_data,
            SUM(consumo_total)::NUMERIC(12,2) AS total_consumo_tarifa,
            SUM(coste_total)::NUMERIC(12,2) AS total_coste_tarifa,
            ROUND(AVG(precio_medio_kwh)::NUMERIC, 4) AS precio_medio_tarifa
        FROM resumen_mensual
        GROUP BY tarifa
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'tarifa', tarifa,
                'total_consumo', total_consumo_tarifa,
                'total_coste', total_coste_tarifa,
                'precio_medio', precio_medio_tarifa,
                'datos_mensuales', meses_data
            ) ORDER BY tarifa
        ),
        '[]'::jsonb
    ) INTO v_resumen_tarifas
    FROM agrupado_por_tarifa;

    -- =====================================================
    -- BLOQUE B: Inventario de Suministros
    -- =====================================================
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'punto_id', ps.id,
                'cups', ps.cups,
                'direccion', ps.direccion_sum,
                'tarifa', COALESCE(ps.tarifa::text, 'Sin tarifa'),
                'comercializadora', COALESCE(c.nombre, 'Sin comercializadora'),
                'comercializadora_id', ps.current_comercializadora_id,
                'potencias_contratadas', jsonb_build_object(
                    'p1', ps.p1_kw,
                    'p2', ps.p2_kw,
                    'p3', ps.p3_kw,
                    'p4', ps.p4_kw,
                    'p5', ps.p5_kw,
                    'p6', ps.p6_kw
                ),
                'estado', ps.estado
            ) ORDER BY ps.cups
        ),
        '[]'::jsonb
    ) INTO v_inventario
    FROM puntos_suministro ps
    LEFT JOIN empresas c ON c.id = ps.current_comercializadora_id
    WHERE ps.cliente_id = p_cliente_id
      AND ps.eliminado_en IS NULL;

    -- =====================================================
    -- BLOQUE C: Análisis de Potencias
    -- =====================================================
    WITH potencias_registradas AS (
        SELECT 
            fc.punto_id,
            MAX(fc.potencia_kw_max)::NUMERIC(10,2) AS potencia_max_registrada,
            AVG(fc.potencia_kw_max)::NUMERIC(10,2) AS potencia_media_registrada
        FROM facturacion_clientes fc
        WHERE fc.cliente_id = p_cliente_id
          AND fc.fecha_emision >= p_fecha_inicio
          AND fc.fecha_emision <= p_fecha_fin
          AND fc.eliminado_en IS NULL
          AND fc.potencia_kw_max IS NOT NULL
        GROUP BY fc.punto_id
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'punto_id', ps.id,
                'cups', ps.cups,
                'tarifa', COALESCE(ps.tarifa::text, 'Sin tarifa'),
                'potencia_contratada_total', COALESCE(ps.p1_kw, 0) + COALESCE(ps.p2_kw, 0) + COALESCE(ps.p3_kw, 0) + 
                                             COALESCE(ps.p4_kw, 0) + COALESCE(ps.p5_kw, 0) + COALESCE(ps.p6_kw, 0),
                'potencia_maxima_registrada', pr.potencia_max_registrada,
                'potencia_media_registrada', pr.potencia_media_registrada,
                'ratio_utilizacion', CASE 
                    WHEN pr.potencia_max_registrada > 0 AND 
                         (COALESCE(ps.p1_kw, 0) + COALESCE(ps.p2_kw, 0) + COALESCE(ps.p3_kw, 0) + 
                          COALESCE(ps.p4_kw, 0) + COALESCE(ps.p5_kw, 0) + COALESCE(ps.p6_kw, 0)) > 0
                    THEN ROUND((pr.potencia_max_registrada / 
                                (COALESCE(ps.p1_kw, 0) + COALESCE(ps.p2_kw, 0) + COALESCE(ps.p3_kw, 0) + 
                                 COALESCE(ps.p4_kw, 0) + COALESCE(ps.p5_kw, 0) + COALESCE(ps.p6_kw, 0))) * 100, 2)
                    ELSE NULL 
                END
            ) ORDER BY ps.cups
        ),
        '[]'::jsonb
    ) INTO v_analisis_potencias
    FROM puntos_suministro ps
    LEFT JOIN potencias_registradas pr ON pr.punto_id = ps.id
    WHERE ps.cliente_id = p_cliente_id
      AND ps.eliminado_en IS NULL;

    -- =====================================================
    -- BLOQUE D: Facturación Agregada por Punto (NUEVO)
    -- Suma consumo y coste por punto_id para calcular extremos
    -- =====================================================
    WITH facturacion_agregada AS (
        SELECT 
            fc.punto_id,
            ps.cups,
            ps.tarifa,
            SUM(fc.consumo_kwh)::NUMERIC(12,2) AS consumo_total,
            SUM(fc.total)::NUMERIC(12,2) AS coste_total,
            -- Precio Medio Efectivo (Coste Total / Consumo)
            CASE 
                WHEN SUM(fc.consumo_kwh) > 0 
                THEN ROUND((SUM(fc.total) / SUM(fc.consumo_kwh))::NUMERIC, 6)
                ELSE 0 
            END AS precio_medio_efectivo,
            -- Precio Medio Energía Ponderado (SUM(precio*consumo) / SUM(consumo))
            CASE 
                WHEN SUM(fc.consumo_kwh) > 0 
                THEN ROUND((SUM(fc.precio_eur_kwh * fc.consumo_kwh) / SUM(fc.consumo_kwh))::NUMERIC, 6)
                ELSE 0 
            END AS precio_medio_energia
        FROM facturacion_clientes fc
        INNER JOIN puntos_suministro ps ON ps.id = fc.punto_id
        WHERE fc.cliente_id = p_cliente_id
          AND fc.fecha_emision >= p_fecha_inicio
          AND fc.fecha_emision <= p_fecha_fin
          AND fc.eliminado_en IS NULL
          AND ps.eliminado_en IS NULL
        GROUP BY fc.punto_id, ps.cups, ps.tarifa
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'punto_id', punto_id,
                'cups', cups,
                'tarifa', COALESCE(tarifa::text, 'Sin tarifa'),
                'consumo_total', consumo_total,
                'coste_total', coste_total,
                'precio_medio', precio_medio_efectivo, -- Mantenemos compatibilidad hacia atrás
                'precio_medio_energia', precio_medio_energia -- Campo NUEVO
            ) ORDER BY cups
        ),
        '[]'::jsonb
    ) INTO v_facturacion_puntos
    FROM facturacion_agregada;

    -- =====================================================
    -- Construir resultado final
    -- =====================================================
    v_result := jsonb_build_object(
        'cliente_id', p_cliente_id,
        'fecha_inicio', p_fecha_inicio,
        'fecha_fin', p_fecha_fin,
        'resumen_por_tarifa', v_resumen_tarifas,
        'inventario_suministros', v_inventario,
        'analisis_potencias', v_analisis_potencias,
        'facturacion_por_punto', v_facturacion_puntos,
        'generado_at', NOW()
    );

    RETURN v_result;
END;
$function$
