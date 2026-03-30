CREATE OR REPLACE FUNCTION public.facturacion_aggregate(
    cliente_ids uuid[] DEFAULT NULL::uuid[],
    punto_ids uuid[] DEFAULT NULL::uuid[],
    comercializadora_ids uuid[] DEFAULT NULL::uuid[],
    tipo_factura_val text DEFAULT NULL::text,
    tarifa_vals text[] DEFAULT NULL::text[],
    provincia_vals text[] DEFAULT NULL::text[],
    fecha_desde date DEFAULT '2000-01-01'::date,
    fecha_hasta date DEFAULT '2100-01-01'::date,
    group_by_key text DEFAULT 'month'::text,
    metrics jsonb DEFAULT '[]'::jsonb,
    top_n integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    result jsonb;
    summary jsonb;
    groups jsonb;
    where_clause text := 'WHERE f.eliminado_en IS NULL';
    from_clause text := ' FROM public.facturacion_clientes f ';
    group_col text;
    group_label text;
    metric_record record;
    select_metrics text := '';
    summary_metrics text := '';
    sql_groups text;
    allowed_groups text[] := ARRAY['month', 'client', 'point', 'retailer', 'invoice_type'];
    allowed_measures text[] := ARRAY['total', 'consumo_kwh', 'precio_eur_kwh', 'potencia_kw'];
    allowed_aggs text[] := ARRAY['sum', 'avg', 'min', 'max'];
    agg_func text;
    measure_col text;
    m_key text;
    has_cf_metric boolean := false;
    has_potencia_metric boolean := false;
BEGIN
    -- 1. Validate group_by
    IF NOT (group_by_key = ANY(allowed_groups)) THEN
        RAISE EXCEPTION 'Invalid group_by_key: %', group_by_key;
    END IF;

    -- 2. Build filters
    IF cliente_ids IS NOT NULL AND array_length(cliente_ids, 1) > 0 THEN
        where_clause := where_clause || ' AND f.cliente_id = ANY(' || quote_literal(cliente_ids) || '::uuid[])';
    END IF;
    IF punto_ids IS NOT NULL AND array_length(punto_ids, 1) > 0 THEN
        where_clause := where_clause || ' AND f.punto_id = ANY(' || quote_literal(punto_ids) || '::uuid[])';
    END IF;
    IF comercializadora_ids IS NOT NULL AND array_length(comercializadora_ids, 1) > 0 THEN
        where_clause := where_clause || ' AND f.comercializadora_id = ANY(' || quote_literal(comercializadora_ids) || '::uuid[])';
    END IF;
    IF tipo_factura_val IS NOT NULL THEN
        where_clause := where_clause || ' AND f.tipo_factura = ' || quote_literal(tipo_factura_val) || '::tipo_factura_enum';
    END IF;
    IF tarifa_vals IS NOT NULL AND array_length(tarifa_vals, 1) > 0 THEN
        where_clause := where_clause || ' AND f.tarifa::text = ANY(' || quote_literal(tarifa_vals) || '::text[])';
    END IF;
    IF provincia_vals IS NOT NULL AND array_length(provincia_vals, 1) > 0 THEN
        where_clause := where_clause || ' AND f.provincia = ANY(' || quote_literal(provincia_vals) || '::text[])';
    END IF;

    -- 3. Build Metrics SQL
    FOR metric_record IN SELECT * FROM jsonb_to_recordset(metrics) AS x(measure text, aggregation text)
    LOOP
        IF NOT (metric_record.measure = ANY(allowed_measures)) THEN
            RAISE EXCEPTION 'Invalid measure: %', metric_record.measure;
        END IF;
        IF NOT (metric_record.aggregation = ANY(allowed_aggs)) THEN
            RAISE EXCEPTION 'Invalid aggregation: %', metric_record.aggregation;
        END IF;

        m_key := quote_ident(metric_record.measure || '_' || metric_record.aggregation);

        -- Métricas basadas en consumos_facturacion
        IF metric_record.measure = 'precio_eur_kwh' THEN
            has_cf_metric := true;
            IF metric_record.aggregation <> 'avg' THEN
                RAISE EXCEPTION 'Invalid aggregation % for measure % (only avg is allowed)', metric_record.aggregation, metric_record.measure;
            END IF;

            select_metrics := select_metrics ||
                ', SUM(COALESCE(cf.precio_kwh, 0) * COALESCE(cf.consumo_kwh, 0))' ||
                ' / NULLIF(SUM(CASE WHEN cf.precio_kwh IS NOT NULL THEN COALESCE(cf.consumo_kwh, 0) ELSE 0 END), 0) as ' || m_key;

            summary_metrics := summary_metrics ||
                ', SUM(COALESCE(cf.precio_kwh, 0) * COALESCE(cf.consumo_kwh, 0))' ||
                ' / NULLIF(SUM(CASE WHEN cf.precio_kwh IS NOT NULL THEN COALESCE(cf.consumo_kwh, 0) ELSE 0 END), 0) as ' || m_key;

        ELSIF metric_record.measure = 'consumo_kwh' THEN
            has_cf_metric := true;
            agg_func := UPPER(metric_record.aggregation);
            select_metrics := select_metrics || ', ' || agg_func || '(cf.consumo_kwh) as ' || m_key;
            summary_metrics := summary_metrics || ', ' || agg_func || '(cf.consumo_kwh) as ' || m_key;

        ELSIF metric_record.measure = 'total' THEN
            has_cf_metric := true;
            agg_func := UPPER(metric_record.aggregation);
            select_metrics := select_metrics || ', ' || agg_func || '(cf.coste_total) as ' || m_key;
            summary_metrics := summary_metrics || ', ' || agg_func || '(cf.coste_total) as ' || m_key;

        -- Potencia agregada sobre potencia mínima y máxima de facturación
        ELSIF metric_record.measure = 'potencia_kw' THEN
            has_potencia_metric := true;
            IF metric_record.aggregation = 'sum' THEN
                select_metrics := select_metrics || ', SUM(COALESCE(potencia_kw_min, 0) + COALESCE(potencia_kw_max, 0)) as ' || m_key;
                summary_metrics := summary_metrics || ', SUM(COALESCE(potencia_kw_min, 0) + COALESCE(potencia_kw_max, 0)) as ' || m_key;
            ELSIF metric_record.aggregation = 'avg' THEN
                select_metrics := select_metrics || ', AVG((COALESCE(potencia_kw_min, 0) + COALESCE(potencia_kw_max, 0)) / 2.0) as ' || m_key;
                summary_metrics := summary_metrics || ', AVG((COALESCE(potencia_kw_min, 0) + COALESCE(potencia_kw_max, 0)) / 2.0) as ' || m_key;
            ELSIF metric_record.aggregation = 'min' THEN
                select_metrics := select_metrics || ', MIN(potencia_kw_min) as ' || m_key;
                summary_metrics := summary_metrics || ', MIN(potencia_kw_min) as ' || m_key;
            ELSIF metric_record.aggregation = 'max' THEN
                select_metrics := select_metrics || ', MAX(potencia_kw_max) as ' || m_key;
                summary_metrics := summary_metrics || ', MAX(potencia_kw_max) as ' || m_key;
            END IF;

        ELSE
            agg_func := UPPER(metric_record.aggregation);
            measure_col := quote_ident(metric_record.measure);
            select_metrics := select_metrics || ', ' || agg_func || '(' || measure_col || ') as ' || m_key;
            summary_metrics := summary_metrics || ', ' || agg_func || '(' || measure_col || ') as ' || m_key;
        END IF;
    END LOOP;

    IF has_cf_metric AND has_potencia_metric THEN
        RAISE EXCEPTION 'Combining potencia_kw with consumo/importe/precio metrics is not supported in a single query';
    END IF;

    IF has_cf_metric THEN
        from_clause := from_clause || ' JOIN public.consumos_facturacion cf ON cf.factura_id = f.id AND cf.eliminado_en IS NULL ';
        where_clause := where_clause || ' AND cf.mes >= ' || quote_literal(fecha_desde) || ' AND cf.mes <= ' || quote_literal(fecha_hasta);
    ELSE
        where_clause := where_clause || ' AND f.fecha_emision >= ' || quote_literal(fecha_desde) || ' AND f.fecha_emision <= ' || quote_literal(fecha_hasta);
    END IF;

    -- 4. Summary Query
    EXECUTE
        'SELECT row_to_json(s)::jsonb FROM (SELECT COUNT(*) as row_count ' || summary_metrics ||
        from_clause || where_clause || ') s'
    INTO summary;

    -- 5. Groups Query
    group_col := CASE group_by_key
        WHEN 'month' THEN CASE WHEN has_cf_metric THEN 'date_trunc(''month'', cf.mes)::text' ELSE 'date_trunc(''month'', f.fecha_emision)::text' END
        WHEN 'client' THEN 'f.cliente_id::text'
        WHEN 'point' THEN 'f.punto_id::text'
        WHEN 'retailer' THEN 'f.comercializadora_id::text'
        WHEN 'invoice_type' THEN 'f.tipo_factura::text'
    END;

    group_label := CASE group_by_key
        WHEN 'client' THEN '(SELECT nombre FROM public.clientes WHERE id = f.cliente_id)'
        WHEN 'point' THEN '(SELECT cups FROM public.puntos_suministro WHERE id = f.punto_id)'
        WHEN 'retailer' THEN '(SELECT nombre FROM public.empresas WHERE id = f.comercializadora_id)'
        ELSE group_col
    END;

    sql_groups :=
        'SELECT jsonb_agg(row_to_json(g)) FROM (' ||
        ' SELECT ' || group_col || ' as group_key, ' ||
        group_label || ' as group_label ' || select_metrics ||
        from_clause || where_clause ||
        ' GROUP BY 1, 2' ||
        ' ORDER BY 1 ASC' ||
        ' LIMIT ' || top_n ||
        ') g';

    EXECUTE sql_groups INTO groups;

    -- 6. Build final JSON
    result := jsonb_build_object(
        'summary', COALESCE(summary, '{}'::jsonb),
        'groups', COALESCE(groups, '[]'::jsonb),
        'meta', jsonb_build_object(
            'group_by', group_by_key,
            'date_from', fecha_desde,
            'date_to', fecha_hasta,
            'row_count', COALESCE((summary->>'row_count')::int, 0)
        )
    );

    RETURN result;
END;
$function$;