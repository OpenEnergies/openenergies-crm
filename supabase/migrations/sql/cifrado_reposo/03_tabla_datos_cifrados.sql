-- ============================================================================
-- FASE 3: TABLA DE DATOS SENSIBLES CIFRADOS
-- ============================================================================
-- Descripción: Crea tabla centralizada para almacenar datos PII cifrados
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32, ISO 27001 A.10.1, SOC 2 CC6.7
-- ============================================================================

-- 3.1 Crear tabla datos_sensibles_cifrados
CREATE TABLE IF NOT EXISTS public.datos_sensibles_cifrados (
    -- Identificador único del registro cifrado
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencia a la entidad original
    entidad_tipo TEXT NOT NULL,          -- 'cliente', 'contrato', 'usuario_app'
    entidad_id UUID NOT NULL,            -- ID del registro original
    campo TEXT NOT NULL,                 -- 'dni', 'cif', 'email', 'iban', 'telefono'
    
    -- Dato cifrado (BYTEA para almacenar datos binarios cifrados)
    valor_cifrado BYTEA NOT NULL,
    
    -- Metadatos de auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraint único: solo un valor por entidad+campo
    CONSTRAINT uq_entidad_campo UNIQUE(entidad_tipo, entidad_id, campo)
);

-- 3.2 Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_datos_sensibles_entidad 
    ON public.datos_sensibles_cifrados(entidad_tipo, entidad_id);

CREATE INDEX IF NOT EXISTS idx_datos_sensibles_campo 
    ON public.datos_sensibles_cifrados(entidad_tipo, campo);

CREATE INDEX IF NOT EXISTS idx_datos_sensibles_created 
    ON public.datos_sensibles_cifrados(created_at);

-- 3.3 Habilitar RLS
ALTER TABLE public.datos_sensibles_cifrados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datos_sensibles_cifrados FORCE ROW LEVEL SECURITY;

-- 3.4 Políticas RLS - Solo administradores pueden acceder
-- Los comerciales acceden SOLO a través de funciones SECURITY DEFINER
DROP POLICY IF EXISTS "datos_sensibles_admin_only" ON public.datos_sensibles_cifrados;

CREATE POLICY "datos_sensibles_admin_only" 
ON public.datos_sensibles_cifrados
FOR ALL
TO authenticated
USING (
    -- Solo administradores pueden ver/modificar directamente
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- 3.5 Comentarios de documentación
COMMENT ON TABLE public.datos_sensibles_cifrados IS 
'Almacén centralizado de datos PII cifrados con AES-256 (pgcrypto).
Cada registro contiene un campo sensible de una entidad específica.
GDPR Art. 32: Cifrado de datos personales.
ISO 27001 A.10.1: Controles criptográficos.
SOC 2 CC6.7: Cifrado en reposo.';

COMMENT ON COLUMN public.datos_sensibles_cifrados.entidad_tipo IS 
'Tipo de entidad: cliente, contrato, usuario_app';

COMMENT ON COLUMN public.datos_sensibles_cifrados.entidad_id IS 
'UUID del registro en la tabla original';

COMMENT ON COLUMN public.datos_sensibles_cifrados.campo IS 
'Nombre del campo sensible: dni, cif, email, iban, telefono';

COMMENT ON COLUMN public.datos_sensibles_cifrados.valor_cifrado IS 
'Dato cifrado con pgp_sym_encrypt usando clave maestra de Vault';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que la tabla existe
SELECT 
    table_name,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'datos_sensibles_cifrados') as num_policies
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'datos_sensibles_cifrados';

-- Verificar RLS
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_class 
WHERE relname = 'datos_sensibles_cifrados';
