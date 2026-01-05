-- ============================================================================
-- 008_storage_security.sql
-- SEGURIDAD DE ALMACENAMIENTO (STORAGE BUCKETS)
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 32, ISO 27001 A.8.2/A.13.2, NIS2 Art. 21, SOC 2 CC6.1
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script configura la seguridad de los buckets de Supabase Storage:
-- 1. Límites de tamaño de archivo para prevenir DOS
-- 2. Restricciones de tipos MIME para prevenir ejecución de código malicioso
-- 3. Políticas RLS para acceso controlado a archivos
-- 4. Auditoría de operaciones de storage

BEGIN;

-- ============================================================================
-- SECCIÓN 1: VERIFICAR BUCKETS EXISTENTES
-- ============================================================================
-- Nota: Los buckets se crean desde el dashboard de Supabase o con SQL

-- Consultar buckets existentes para referencia
DO $$
BEGIN
    RAISE NOTICE 'Verificando buckets de storage...';
    RAISE NOTICE 'Los buckets deben configurarse desde el dashboard de Supabase';
END $$;

-- ============================================================================
-- SECCIÓN 2: TABLA DE CONFIGURACIÓN DE BUCKETS
-- ============================================================================
-- Almacena configuración de seguridad adicional por bucket

CREATE TABLE IF NOT EXISTS public.storage_bucket_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_name TEXT NOT NULL UNIQUE,
    
    -- Límites de archivo
    max_file_size_bytes BIGINT NOT NULL DEFAULT 5242880,  -- 5MB por defecto
    max_files_per_user INT DEFAULT 100,
    
    -- Tipos MIME permitidos
    allowed_mime_types TEXT[] NOT NULL DEFAULT '{}',
    
    -- Extensiones prohibidas (siempre bloqueadas)
    blocked_extensions TEXT[] DEFAULT ARRAY[
        'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jse',
        'ws', 'wsf', 'msc', 'msi', 'msp', 'ps1', 'ps1xml', 'ps2',
        'ps2xml', 'psc1', 'psc2', 'sh', 'bash', 'csh', 'ksh', 'php',
        'php3', 'php4', 'php5', 'phtml', 'asp', 'aspx', 'ascx',
        'cer', 'crt', 'der', 'dll', 'so', 'dylib', 'hta', 'htm',
        'html', 'jar', 'java', 'pl', 'pm', 'py', 'pyc', 'pyo',
        'rb', 'reg', 'sql', 'vb', 'vbe', 'vbscript'
    ],
    
    -- Configuración de acceso
    require_auth BOOLEAN DEFAULT TRUE,
    public_access BOOLEAN DEFAULT FALSE,
    
    -- Metadatos
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMPTZ
);

-- Insertar configuración para buckets existentes
INSERT INTO public.storage_bucket_config (
    bucket_name, max_file_size_bytes, allowed_mime_types, require_auth, description
) VALUES 
    (
        'avatars',
        1048576,  -- 1MB para avatares
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        TRUE,
        'Avatares de usuarios - Solo imágenes, máximo 1MB'
    ),
    (
        'documentos',
        52428800,  -- 50MB para documentos
        ARRAY[
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/zip',
            'application/x-rar-compressed'
        ],
        TRUE,
        'Documentos de clientes - PDFs, Office, imágenes, max 50MB'
    ),
    (
        'facturas',
        10485760,  -- 10MB para facturas
        ARRAY['application/pdf', 'image/jpeg', 'image/png'],
        TRUE,
        'Facturas digitalizadas - Solo PDFs e imágenes, max 10MB'
    ),
    (
        'contratos',
        20971520,  -- 20MB para contratos
        ARRAY['application/pdf'],
        TRUE,
        'Contratos firmados - Solo PDFs, max 20MB'
    )
ON CONFLICT (bucket_name) DO UPDATE SET
    max_file_size_bytes = EXCLUDED.max_file_size_bytes,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    description = EXCLUDED.description,
    updated_at = current_timestamp;

-- RLS para configuración
ALTER TABLE public.storage_bucket_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY sbc_select ON public.storage_bucket_config
    FOR SELECT TO authenticated
    USING (TRUE);  -- Todos pueden ver la configuración

CREATE POLICY sbc_modify ON public.storage_bucket_config
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- SECCIÓN 3: FUNCIÓN DE VALIDACIÓN DE ARCHIVOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_file_upload(
    p_bucket_name TEXT,
    p_file_name TEXT,
    p_file_size BIGINT,
    p_mime_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_config RECORD;
    v_extension TEXT;
    v_errors TEXT[] := '{}';
BEGIN
    -- Obtener configuración del bucket
    SELECT * INTO v_config
    FROM public.storage_bucket_config
    WHERE bucket_name = p_bucket_name;
    
    IF NOT FOUND THEN
        -- Bucket no configurado - usar valores por defecto estrictos
        v_config.max_file_size_bytes := 5242880;
        v_config.allowed_mime_types := ARRAY['application/pdf', 'image/jpeg', 'image/png'];
        v_config.blocked_extensions := ARRAY['exe', 'bat', 'cmd', 'js', 'php', 'sh'];
    END IF;
    
    -- Extraer extensión del archivo
    v_extension := LOWER(REGEXP_REPLACE(p_file_name, '.*\.', ''));
    
    -- Validar extensión bloqueada
    IF v_extension = ANY(v_config.blocked_extensions) THEN
        v_errors := array_append(v_errors, 
            format('Extensión .%s no permitida por razones de seguridad', v_extension));
        
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
    
    -- Validar tamaño
    IF p_file_size > v_config.max_file_size_bytes THEN
        v_errors := array_append(v_errors,
            format('Archivo demasiado grande. Máximo: %s bytes, recibido: %s bytes',
                v_config.max_file_size_bytes, p_file_size));
    END IF;
    
    -- Validar tipo MIME
    IF array_length(v_config.allowed_mime_types, 1) > 0 
       AND NOT p_mime_type = ANY(v_config.allowed_mime_types) THEN
        v_errors := array_append(v_errors,
            format('Tipo de archivo no permitido: %s', p_mime_type));
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
        'max_size', v_config.max_file_size_bytes,
        'allowed_types', v_config.allowed_mime_types
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 4: TABLA DE AUDITORÍA DE STORAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.storage_access_log (
    id BIGSERIAL PRIMARY KEY,
    bucket_name TEXT NOT NULL,
    object_path TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DOWNLOAD')),
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    file_size BIGINT,
    mime_type TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_storage_log_bucket 
    ON audit.storage_access_log (bucket_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_storage_log_user 
    ON audit.storage_access_log (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storage_log_timestamp 
    ON audit.storage_access_log (timestamp);

-- RLS para logs de storage
ALTER TABLE audit.storage_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_log_admin ON audit.storage_access_log
    FOR ALL TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- SECCIÓN 5: FUNCIÓN PARA REGISTRAR ACCESO A STORAGE
-- ============================================================================

CREATE OR REPLACE FUNCTION audit.log_storage_access(
    p_bucket_name TEXT,
    p_object_path TEXT,
    p_operation TEXT,
    p_success BOOLEAN DEFAULT TRUE,
    p_failure_reason TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_mime_type TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public, pg_catalog
AS $$
BEGIN
    INSERT INTO audit.storage_access_log (
        bucket_name, object_path, operation, user_id,
        ip_address, file_size, mime_type, success,
        failure_reason, metadata
    ) VALUES (
        p_bucket_name, p_object_path, p_operation, auth.uid(),
        inet_client_addr(), p_file_size, p_mime_type, p_success,
        p_failure_reason, p_metadata
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 6: POLÍTICAS RLS PARA STORAGE.OBJECTS
-- ============================================================================
-- Nota: Las políticas de storage.objects se gestionan desde el dashboard
-- Aquí documentamos las políticas recomendadas

COMMENT ON SCHEMA storage IS 
'Schema de Supabase Storage.
POLÍTICAS RECOMENDADAS (aplicar desde dashboard):

BUCKET: avatars
--------------
SELECT: authenticated users can view all avatars
  ((bucket_id = ''avatars''::text) AND (auth.role() = ''authenticated''::text))

INSERT: users can upload their own avatar
  ((bucket_id = ''avatars''::text) AND (auth.uid() = (storage.foldername(name))[1]::uuid))

UPDATE: users can update their own avatar
  ((bucket_id = ''avatars''::text) AND (auth.uid() = (storage.foldername(name))[1]::uuid))

DELETE: users can delete their own avatar
  ((bucket_id = ''avatars''::text) AND (auth.uid() = (storage.foldername(name))[1]::uuid))

BUCKET: documentos
------------------
SELECT: admins see all, comercials see their clients
  ((bucket_id = ''documentos''::text) AND 
   (public.is_admin() OR 
    public.can_access_cliente((storage.foldername(name))[1]::uuid)))

INSERT: admins and comercials can upload
  ((bucket_id = ''documentos''::text) AND 
   (public.is_admin() OR 
    (public.current_user_role() = ''comercial'' AND 
     public.can_access_cliente((storage.foldername(name))[1]::uuid))))

UPDATE: only admins
  ((bucket_id = ''documentos''::text) AND public.is_admin())

DELETE: only admins
  ((bucket_id = ''documentos''::text) AND public.is_admin())
';

-- ============================================================================
-- SECCIÓN 7: FUNCIÓN PARA LIMPIEZA DE ARCHIVOS HUÉRFANOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphan_storage_files(
    p_bucket_name TEXT DEFAULT 'documentos',
    p_days_old INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
    v_orphans RECORD;
    v_deleted INT := 0;
    v_errors INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden ejecutar limpieza';
    END IF;
    
    -- Buscar archivos en storage sin referencia en documentos
    FOR v_orphans IN
        SELECT o.id, o.name, o.bucket_id
        FROM storage.objects o
        WHERE o.bucket_id = p_bucket_name
          AND o.created_at < (current_timestamp - (p_days_old || ' days')::INTERVAL)
          AND NOT EXISTS (
              SELECT 1 FROM public.documentos d
              WHERE d.storage_path = o.name
          )
        LIMIT 100  -- Procesar máximo 100 por ejecución
    LOOP
        BEGIN
            -- Registrar antes de eliminar
            PERFORM audit.log_storage_access(
                v_orphans.bucket_id, v_orphans.name, 'DELETE',
                TRUE, NULL, NULL, NULL,
                jsonb_build_object('reason', 'orphan_cleanup')
            );
            
            -- Eliminar archivo huérfano
            DELETE FROM storage.objects WHERE id = v_orphans.id;
            v_deleted := v_deleted + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'bucket', p_bucket_name,
        'deleted', v_deleted,
        'errors', v_errors,
        'days_threshold', p_days_old,
        'executed_at', current_timestamp
    );
END;
$$;

-- ============================================================================
-- SECCIÓN 8: FUNCIÓN PARA VERIFICAR INTEGRIDAD DE ARCHIVOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_storage_integrity(p_bucket_name TEXT)
RETURNS TABLE (
    documento_id UUID,
    storage_path TEXT,
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
    -- Documentos sin archivo en storage
    SELECT 
        d.id,
        d.storage_path,
        'MISSING'::TEXT,
        'Archivo no encontrado en storage'::TEXT
    FROM public.documentos d
    WHERE d.storage_path IS NOT NULL
      AND d.eliminado_en IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM storage.objects o
          WHERE o.name = d.storage_path
            AND o.bucket_id = p_bucket_name
      )
    
    UNION ALL
    
    -- Archivos sin documento asociado
    SELECT 
        NULL::UUID,
        o.name,
        'ORPHAN'::TEXT,
        'Archivo sin documento asociado'::TEXT
    FROM storage.objects o
    WHERE o.bucket_id = p_bucket_name
      AND NOT EXISTS (
          SELECT 1 FROM public.documentos d
          WHERE d.storage_path = o.name
      );
END;
$$;

-- ============================================================================
-- SECCIÓN 9: POLÍTICA DE ESCANEO DE VIRUS (PLACEHOLDER)
-- ============================================================================
-- Nota: El escaneo de virus requiere un servicio externo
-- Esta función actúa como placeholder para integración futura

CREATE OR REPLACE FUNCTION public.request_virus_scan(
    p_bucket_name TEXT,
    p_object_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- TODO: Integrar con servicio de escaneo de virus (ClamAV, VirusTotal, etc.)
    -- Por ahora, registramos la solicitud y retornamos pending
    
    INSERT INTO audit.storage_access_log (
        bucket_name, object_path, operation, user_id, success, metadata
    ) VALUES (
        p_bucket_name, p_object_path, 'SCAN_REQUESTED', auth.uid(), TRUE,
        jsonb_build_object('scan_type', 'virus', 'status', 'pending')
    );
    
    v_result := jsonb_build_object(
        'status', 'pending',
        'message', 'Escaneo de virus solicitado. Integración pendiente.',
        'bucket', p_bucket_name,
        'path', p_object_path
    );
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.request_virus_scan IS 
'Placeholder para integración con servicio de escaneo de virus.
ISO 27001 A.12.2.1 - Controles contra malware.
Requiere integración con ClamAV, VirusTotal u otro servicio.';

-- ============================================================================
-- SECCIÓN 10: ESTADÍSTICAS DE USO DE STORAGE
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
        'by_bucket', (
            SELECT jsonb_object_agg(
                bucket_id,
                jsonb_build_object(
                    'total_files', COUNT(*),
                    'total_size_bytes', SUM(COALESCE((metadata->>'size')::BIGINT, 0)),
                    'avg_file_size', AVG(COALESCE((metadata->>'size')::BIGINT, 0))
                )
            )
            FROM storage.objects
            GROUP BY bucket_id
        ),
        'by_mime_type', (
            SELECT jsonb_object_agg(
                COALESCE(metadata->>'mimetype', 'unknown'),
                COUNT(*)
            )
            FROM storage.objects
            GROUP BY metadata->>'mimetype'
        ),
        'uploads_last_24h', (
            SELECT COUNT(*) FROM storage.objects
            WHERE created_at > current_timestamp - INTERVAL '24 hours'
        ),
        'uploads_last_7d', (
            SELECT COUNT(*) FROM storage.objects
            WHERE created_at > current_timestamp - INTERVAL '7 days'
        ),
        'total_files', (SELECT COUNT(*) FROM storage.objects),
        'generated_at', current_timestamp
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$;

-- ============================================================================
-- SECCIÓN 11: GRANTS
-- ============================================================================

GRANT SELECT ON public.storage_bucket_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_file_upload TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_storage_files TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_storage_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_virus_scan TO authenticated;
GRANT EXECUTE ON FUNCTION audit.log_storage_access TO authenticated;

COMMIT;

-- ============================================================================
-- INSTRUCCIONES POST-MIGRACIÓN
-- ============================================================================
/*
-- Las siguientes configuraciones deben hacerse desde el Dashboard de Supabase:

1. CONFIGURAR BUCKETS (Storage > New bucket):
   - avatars: Public = FALSE, File size limit = 1MB
   - documentos: Public = FALSE, File size limit = 50MB
   - facturas: Public = FALSE, File size limit = 10MB
   - contratos: Public = FALSE, File size limit = 20MB

2. CONFIGURAR MIME TYPES PERMITIDOS (por bucket):
   - avatars: image/jpeg, image/png, image/gif, image/webp
   - documentos: application/pdf, application/msword, image/*, etc.
   - facturas: application/pdf, image/jpeg, image/png
   - contratos: application/pdf

3. CREAR POLÍTICAS RLS en cada bucket (ver comentarios en SECCIÓN 6)

4. Verificar configuración:
SELECT * FROM public.storage_bucket_config;

5. Probar validación:
SELECT public.validate_file_upload('avatars', 'test.jpg', 500000, 'image/jpeg');
SELECT public.validate_file_upload('avatars', 'malware.exe', 500000, 'application/x-executable');

6. Ver estadísticas:
SELECT public.get_storage_statistics();
*/
