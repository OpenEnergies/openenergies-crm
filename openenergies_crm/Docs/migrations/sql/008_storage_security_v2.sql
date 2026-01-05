-- ============================================================================
-- 008_storage_security_v2.sql
-- MEJORAS DE SEGURIDAD PARA STORAGE EXISTENTE
-- OpenEnergies CRM - Migración de Seguridad (Simplificada)
-- ============================================================================
-- NOTA: Esta versión solo mejora lo que ya existe, no añade tablas innecesarias
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECCIÓN 1: ACTUALIZAR CONFIGURACIÓN DE BUCKETS EXISTENTES
-- ============================================================================
-- Añadir límites de tamaño y MIME types donde faltan

-- Bucket: avatars (actualmente sin límites)
UPDATE storage.buckets 
SET 
    file_size_limit = 1048576,  -- 1MB máximo para avatares
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'avatars';

-- Bucket: documentos (actualmente sin límites)
UPDATE storage.buckets 
SET 
    file_size_limit = 52428800,  -- 50MB máximo
    allowed_mime_types = ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ]
WHERE id = 'documentos';

-- ============================================================================
-- SECCIÓN 2: FUNCIÓN DE VALIDACIÓN USANDO CONFIG NATIVA
-- ============================================================================
-- Función para validar archivos antes de subir (usa storage.buckets directamente)

CREATE OR REPLACE FUNCTION public.validate_file_upload(
    p_bucket_name TEXT,
    p_file_name TEXT,
    p_file_size BIGINT,
    p_mime_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
    v_bucket RECORD;
    v_extension TEXT;
    v_errors TEXT[] := '{}';
    v_blocked_extensions TEXT[] := ARRAY[
        'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 
        'ps1', 'sh', 'bash', 'php', 'asp', 'aspx', 'dll', 'so'
    ];
BEGIN
    -- Obtener configuración del bucket desde storage.buckets (tabla nativa)
    SELECT id, file_size_limit, allowed_mime_types
    INTO v_bucket
    FROM storage.buckets
    WHERE id = p_bucket_name;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', FALSE,
            'errors', ARRAY['Bucket no existe: ' || p_bucket_name]
        );
    END IF;
    
    -- Extraer extensión del archivo
    v_extension := LOWER(REGEXP_REPLACE(p_file_name, '.*\.', ''));
    
    -- Validar extensión bloqueada (siempre peligrosa)
    IF v_extension = ANY(v_blocked_extensions) THEN
        v_errors := array_append(v_errors, 
            format('Extensión .%s no permitida por razones de seguridad', v_extension));
        
        -- Registrar intento en security_events
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'BLOCKED_FILE_EXTENSION', auth.uid(), current_timestamp, FALSE,
            'Intento de subir archivo con extensión bloqueada',
            jsonb_build_object(
                'bucket', p_bucket_name,
                'filename', p_file_name,
                'extension', v_extension
            )
        );
    END IF;
    
    -- Validar tamaño (si el bucket tiene límite)
    IF v_bucket.file_size_limit IS NOT NULL AND p_file_size > v_bucket.file_size_limit THEN
        v_errors := array_append(v_errors,
            format('Archivo demasiado grande. Máximo: %s bytes, recibido: %s bytes',
                v_bucket.file_size_limit, p_file_size));
    END IF;
    
    -- Validar tipo MIME (si el bucket tiene restricciones)
    IF v_bucket.allowed_mime_types IS NOT NULL 
       AND array_length(v_bucket.allowed_mime_types, 1) > 0 
       AND NOT p_mime_type = ANY(v_bucket.allowed_mime_types) THEN
        v_errors := array_append(v_errors,
            format('Tipo de archivo no permitido: %s. Permitidos: %s', 
                p_mime_type, array_to_string(v_bucket.allowed_mime_types, ', ')));
    END IF;
    
    -- Validar nombre de archivo para path traversal
    IF p_file_name LIKE '%..%' OR p_file_name LIKE '%/%' OR p_file_name LIKE '%\%' THEN
        v_errors := array_append(v_errors, 'Nombre de archivo inválido');
        
        INSERT INTO audit.security_events (
            event_type, user_id, event_timestamp, success, failure_reason, metadata
        ) VALUES (
            'PATH_TRAVERSAL_ATTEMPT', auth.uid(), current_timestamp, FALSE,
            'Intento de path traversal en nombre de archivo',
            jsonb_build_object('bucket', p_bucket_name, 'filename', p_file_name)
        );
    END IF;
    
    -- Retornar resultado
    IF array_length(v_errors, 1) > 0 THEN
        RETURN jsonb_build_object(
            'valid', FALSE,
            'errors', to_jsonb(v_errors)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'valid', TRUE,
        'bucket', p_bucket_name,
        'max_size', v_bucket.file_size_limit,
        'allowed_types', v_bucket.allowed_mime_types
    );
END;
$$;

COMMENT ON FUNCTION public.validate_file_upload IS 
'Valida archivos antes de subir usando la configuración nativa de storage.buckets.
Bloquea extensiones peligrosas y registra intentos sospechosos.';

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN PARA VER ESTADÍSTICAS DE STORAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_storage_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden ver estadísticas';
    END IF;
    
    SELECT jsonb_build_object(
        'buckets', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', b.id,
                'public', b.public,
                'file_size_limit', b.file_size_limit,
                'allowed_mime_types', b.allowed_mime_types,
                'file_count', COALESCE(o.cnt, 0),
                'total_size_bytes', COALESCE(o.total_size, 0)
            ))
            FROM storage.buckets b
            LEFT JOIN (
                SELECT bucket_id, COUNT(*) as cnt, 
                       SUM(COALESCE((metadata->>'size')::BIGINT, 0)) as total_size
                FROM storage.objects
                GROUP BY bucket_id
            ) o ON o.bucket_id = b.id
        ),
        'total_files', (SELECT COUNT(*) FROM storage.objects),
        'uploads_last_7d', (
            SELECT COUNT(*) FROM storage.objects
            WHERE created_at > current_timestamp - INTERVAL '7 days'
        ),
        'generated_at', current_timestamp
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$;

-- ============================================================================
-- SECCIÓN 4: FUNCIÓN PARA VERIFICAR INTEGRIDAD DOCUMENTOS <-> STORAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_storage_integrity(p_bucket_name TEXT DEFAULT 'documentos')
RETURNS TABLE (
    documento_id UUID,
    ruta_storage TEXT,
    status TEXT,
    issue TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden verificar integridad';
    END IF;
    
    RETURN QUERY
    -- Documentos que apuntan a archivos que no existen en storage
    SELECT 
        d.id,
        d.ruta_storage,
        'MISSING'::TEXT,
        'Archivo no encontrado en storage'::TEXT
    FROM public.documentos d
    WHERE d.ruta_storage IS NOT NULL
      AND d.eliminado_en IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM storage.objects o
          WHERE o.name = d.ruta_storage
            AND o.bucket_id = p_bucket_name
      )
    
    UNION ALL
    
    -- Archivos en storage sin referencia en documentos (huérfanos)
    SELECT 
        NULL::UUID,
        o.name,
        'ORPHAN'::TEXT,
        'Archivo sin documento asociado'::TEXT
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket_name
      AND NOT EXISTS (
          SELECT 1 FROM public.documentos d
          WHERE d.ruta_storage = o.name
      );
END;
$$;

-- ============================================================================
-- SECCIÓN 5: GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.validate_file_upload TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_storage_integrity TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- 1. Verificar configuración actualizada de buckets
SELECT id, public, file_size_limit, allowed_mime_types 
FROM storage.buckets;

-- 2. Probar validación de archivo válido
SELECT public.validate_file_upload('avatars', 'foto.jpg', 500000, 'image/jpeg');

-- 3. Probar validación de archivo bloqueado
SELECT public.validate_file_upload('documentos', 'virus.exe', 1000, 'application/x-executable');

-- 4. Probar validación de archivo demasiado grande
SELECT public.validate_file_upload('avatars', 'foto.jpg', 5000000, 'image/jpeg');

-- 5. Ver estadísticas de storage
SELECT public.get_storage_statistics();

-- 6. Verificar integridad
SELECT * FROM public.verify_storage_integrity('documentos');
*/
