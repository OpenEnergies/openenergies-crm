-- Add get_market_chart_data function
CREATE OR REPLACE FUNCTION market_data.get_market_chart_data(
    p_geo_id INTEGER DEFAULT 8741,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    hour text,
    price_omie numeric,
    price_pvpc numeric,
    period_discriminator text
)
LANGUAGE sql
STABLE
AS $$
    WITH hours AS (
        SELECT generate_series(0, 23) AS h
    ),
    pvpc_data AS (
        SELECT 
            EXTRACT(HOUR FROM datetime_local) AS h, 
            value as price
        FROM market_data.esios_values
        WHERE indicator_id = 1001 
          AND geo_id = p_geo_id
          AND datetime_local::date = p_date
    ),
    omie_data AS (
        SELECT 
            EXTRACT(HOUR FROM datetime_local) AS h, 
            value as price
        FROM market_data.esios_values
        WHERE indicator_id = 600 
          AND geo_id = p_geo_id
          AND datetime_local::date = p_date
    ),
    period_data AS (
        SELECT 
            EXTRACT(HOUR FROM datetime_local) AS h, 
            value as val, -- 1, 2, 3
            CASE 
                WHEN value = 1 THEN 'P1'
                WHEN value = 2 THEN 'P2'
                WHEN value = 3 THEN 'P3'
            END as period_text
        FROM market_data.esios_values
        WHERE indicator_id = 1002
          AND geo_id = p_geo_id
          AND datetime_local::date = p_date
    )
    SELECT 
        TO_CHAR(make_time(h.h, 0, 0), 'HH24:MI') as hour,
        COALESCE(o.price, 0) as price_omie,
        COALESCE(p.price, 0) as price_pvpc,
        COALESCE(pe.period_text, 'P3') as period_discriminator
    FROM hours h
    LEFT JOIN pvpc_data p ON h.h = p.h
    LEFT JOIN omie_data o ON h.h = o.h
    LEFT JOIN period_data pe ON h.h = pe.h
    ORDER BY h.h;
$$;

GRANT EXECUTE ON FUNCTION market_data.get_market_chart_data(integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION market_data.get_market_chart_data(integer, date) TO service_role;
