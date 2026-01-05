-- ============================================================================
-- 002_traceability_columns.sql
-- COLUMNAS DE TRAZABILIDAD Y SOFT DELETE
-- OpenEnergies CRM - Migración de Seguridad
-- ============================================================================
-- Cumplimiento: GDPR Art. 5/17, ISO 27001 A.12.4, NIS2 Art. 23, SOC 2 CC6.1
-- Fecha: 5 de enero de 2026
-- Versión: 1.0
-- ============================================================================

-- ============================================================================
-- DESCRIPCIÓN
-- ============================================================================
-- Este script agrega columnas de trazabilidad a todas las tablas principales:
-- - creado_por: UUID del usuario que creó el registro
-- - modificado_en: Timestamp de última modificación
-- - modificado_por: UUID del usuario que modificó
-- - eliminado_en: Timestamp de eliminación (Soft Delete)
-- - eliminado_por: UUID del usuario que eliminó
-- - version: Número de versión para control de concurrencia optimista

BEGIN;

-- ============================================================================
-- SECCIÓN 1: FUNCIÓN AUXILIAR PARA AGREGAR COLUMNAS DE FORMA SEGURA
-- ============================================================================

CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    p_table_name TEXT,
    p_column_name TEXT,
    p_column_definition TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = p_table_name 
          AND column_name = p_column_name
    ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', 
            p_table_name, p_column_name, p_column_definition);
        RAISE NOTICE 'Columna %.% agregada', p_table_name, p_column_name;
    ELSE
        RAISE NOTICE 'Columna %.% ya existe, omitiendo', p_table_name, p_column_name;
    END IF;
END;
$$;

-- ============================================================================
-- SECCIÓN 2: AGREGAR COLUMNAS A TABLA CLIENTES
-- ============================================================================

-- creado_por
SELECT add_column_if_not_exists('clientes', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

-- modificado_en
SELECT add_column_if_not_exists('clientes', 'modificado_en', 
    'TIMESTAMPTZ');

-- modificado_por
SELECT add_column_if_not_exists('clientes', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

-- eliminado_en (Soft Delete - GDPR critical)
SELECT add_column_if_not_exists('clientes', 'eliminado_en', 
    'TIMESTAMPTZ');

-- eliminado_por
SELECT add_column_if_not_exists('clientes', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

-- version (Optimistic Locking)
SELECT add_column_if_not_exists('clientes', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

-- Índices para soft delete y búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_eliminado_en 
    ON public.clientes (eliminado_en) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_creado_por 
    ON public.clientes (creado_por) WHERE creado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_modificado_por 
    ON public.clientes (modificado_por) WHERE modificado_por IS NOT NULL;

COMMENT ON COLUMN public.clientes.creado_por IS 'UUID del usuario que creó el registro (GDPR Art. 30)';
COMMENT ON COLUMN public.clientes.modificado_en IS 'Fecha/hora de última modificación (ISO 27001 A.12.4)';
COMMENT ON COLUMN public.clientes.modificado_por IS 'UUID del usuario que realizó la última modificación';
COMMENT ON COLUMN public.clientes.eliminado_en IS 'Soft delete timestamp - registro no eliminado físicamente (GDPR Art. 17)';
COMMENT ON COLUMN public.clientes.eliminado_por IS 'UUID del usuario que marcó el registro como eliminado';
COMMENT ON COLUMN public.clientes.version IS 'Versión para control de concurrencia optimista (OCC)';

-- ============================================================================
-- SECCIÓN 3: AGREGAR COLUMNAS A TABLA CONTRATOS
-- ============================================================================

SELECT add_column_if_not_exists('contratos', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('contratos', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('contratos', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('contratos', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('contratos', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('contratos', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_contratos_eliminado_en 
    ON public.contratos (eliminado_en) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_contratos_creado_por 
    ON public.contratos (creado_por) WHERE creado_por IS NOT NULL;

COMMENT ON COLUMN public.contratos.eliminado_en IS 'Soft delete para contratos - retención legal 10 años';

-- ============================================================================
-- SECCIÓN 4: AGREGAR COLUMNAS A TABLA DOCUMENTOS
-- ============================================================================

SELECT add_column_if_not_exists('documentos', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('documentos', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('documentos', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('documentos', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('documentos', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('documentos', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('documentos', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_documentos_eliminado_en 
    ON public.documentos (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 5: AGREGAR COLUMNAS A TABLA EMPRESAS
-- ============================================================================

SELECT add_column_if_not_exists('empresas', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('empresas', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('empresas', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('empresas', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('empresas', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('empresas', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_empresas_eliminado_en 
    ON public.empresas (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 6: AGREGAR COLUMNAS A TABLA FACTURAS
-- ============================================================================

SELECT add_column_if_not_exists('facturas', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('facturas', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturas', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('facturas', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturas', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('facturas', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturas', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

-- Facturas requieren retención fiscal - índice importante
CREATE INDEX IF NOT EXISTS idx_facturas_eliminado_en 
    ON public.facturas (eliminado_en) WHERE eliminado_en IS NULL;

COMMENT ON COLUMN public.facturas.eliminado_en IS 'Soft delete - IMPORTANTE: facturas tienen retención legal 10 años (Ley 58/2003)';

-- ============================================================================
-- SECCIÓN 7: AGREGAR COLUMNAS A TABLA LINEAS_FACTURA
-- ============================================================================

SELECT add_column_if_not_exists('lineas_factura', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('lineas_factura', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('lineas_factura', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('lineas_factura', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('lineas_factura', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('lineas_factura', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('lineas_factura', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_lineas_factura_eliminado_en 
    ON public.lineas_factura (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 8: AGREGAR COLUMNAS A TABLA PUNTOS_SUMINISTRO
-- ============================================================================

SELECT add_column_if_not_exists('puntos_suministro', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('puntos_suministro', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('puntos_suministro', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('puntos_suministro', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('puntos_suministro', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('puntos_suministro', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_puntos_suministro_eliminado_en 
    ON public.puntos_suministro (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 9: AGREGAR COLUMNAS A TABLA TARIFAS
-- ============================================================================

SELECT add_column_if_not_exists('tarifas', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('tarifas', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('tarifas', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('tarifas', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('tarifas', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('tarifas', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('tarifas', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_tarifas_eliminado_en 
    ON public.tarifas (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 10: AGREGAR COLUMNAS A TABLA USUARIOS_APP
-- ============================================================================

SELECT add_column_if_not_exists('usuarios_app', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('usuarios_app', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('usuarios_app', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('usuarios_app', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('usuarios_app', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('usuarios_app', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

-- Campos adicionales de seguridad para usuarios
SELECT add_column_if_not_exists('usuarios_app', 'ultimo_login', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('usuarios_app', 'ultimo_login_ip', 
    'INET');
SELECT add_column_if_not_exists('usuarios_app', 'intentos_fallidos', 
    'INTEGER DEFAULT 0');
SELECT add_column_if_not_exists('usuarios_app', 'bloqueado_hasta', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('usuarios_app', 'password_changed_at', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('usuarios_app', 'require_password_change', 
    'BOOLEAN DEFAULT FALSE');

CREATE INDEX IF NOT EXISTS idx_usuarios_app_eliminado_en 
    ON public.usuarios_app (eliminado_en) WHERE eliminado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_app_bloqueado 
    ON public.usuarios_app (bloqueado_hasta) WHERE bloqueado_hasta IS NOT NULL;

COMMENT ON COLUMN public.usuarios_app.ultimo_login IS 'Timestamp del último login exitoso (NIS2 Art. 21)';
COMMENT ON COLUMN public.usuarios_app.intentos_fallidos IS 'Contador de intentos de login fallidos (SOC 2 CC6.1)';
COMMENT ON COLUMN public.usuarios_app.bloqueado_hasta IS 'Cuenta bloqueada hasta esta fecha por exceso de intentos fallidos';
COMMENT ON COLUMN public.usuarios_app.require_password_change IS 'Forzar cambio de contraseña en próximo login';

-- ============================================================================
-- SECCIÓN 11: AGREGAR COLUMNAS A TABLA FACTURACION_CLIENTES
-- ============================================================================

SELECT add_column_if_not_exists('facturacion_clientes', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturacion_clientes', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('facturacion_clientes', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturacion_clientes', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('facturacion_clientes', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('facturacion_clientes', 'version', 
    'INTEGER NOT NULL DEFAULT 1');

CREATE INDEX IF NOT EXISTS idx_facturacion_clientes_eliminado_en 
    ON public.facturacion_clientes (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 12: AGREGAR COLUMNAS A TABLAS SECUNDARIAS
-- ============================================================================

-- Comparativas
SELECT add_column_if_not_exists('comparativas', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('comparativas', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('comparativas', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('comparativas', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('comparativas', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('comparativas', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS idx_comparativas_eliminado_en 
    ON public.comparativas (eliminado_en) WHERE eliminado_en IS NULL;

-- Consumos
SELECT add_column_if_not_exists('consumos', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('consumos', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('consumos', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('consumos', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('consumos', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('consumos', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS idx_consumos_eliminado_en 
    ON public.consumos (eliminado_en) WHERE eliminado_en IS NULL;

-- Contactos_cliente
SELECT add_column_if_not_exists('contactos_cliente', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('contactos_cliente', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('contactos_cliente', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('contactos_cliente', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('contactos_cliente', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('contactos_cliente', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS idx_contactos_cliente_eliminado_en 
    ON public.contactos_cliente (eliminado_en) WHERE eliminado_en IS NULL;

-- Notificaciones
SELECT add_column_if_not_exists('notificaciones', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('notificaciones', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('notificaciones', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('notificaciones', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('notificaciones', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('notificaciones', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS idx_notificaciones_eliminado_en 
    ON public.notificaciones (eliminado_en) WHERE eliminado_en IS NULL;

-- Remesas
SELECT add_column_if_not_exists('remesas', 'creado_en', 
    'TIMESTAMPTZ DEFAULT current_timestamp');
SELECT add_column_if_not_exists('remesas', 'creado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('remesas', 'modificado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('remesas', 'modificado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');
SELECT add_column_if_not_exists('remesas', 'eliminado_en', 
    'TIMESTAMPTZ');
SELECT add_column_if_not_exists('remesas', 'eliminado_por', 
    'UUID REFERENCES auth.users(id) ON DELETE SET NULL');

CREATE INDEX IF NOT EXISTS idx_remesas_eliminado_en 
    ON public.remesas (eliminado_en) WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 13: TRIGGERS PARA ACTUALIZAR MODIFICADO_EN AUTOMÁTICAMENTE
-- ============================================================================

-- Función genérica para actualizar timestamp de modificación
CREATE OR REPLACE FUNCTION public.update_modified_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.modificado_en := current_timestamp;
    NEW.modificado_por := auth.uid();
    NEW.version := COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_modified_timestamp() IS 
'Trigger function para actualizar automáticamente modificado_en, modificado_por y version.
Se ejecuta en cada UPDATE de las tablas principales.';

-- Función específica para soft delete
CREATE OR REPLACE FUNCTION public.handle_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si se está marcando como eliminado (eliminado_en pasa de NULL a valor)
    IF OLD.eliminado_en IS NULL AND NEW.eliminado_en IS NOT NULL THEN
        NEW.eliminado_por := auth.uid();
        NEW.modificado_en := current_timestamp;
        NEW.modificado_por := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

-- Crear triggers para cada tabla principal

-- Clientes
DROP TRIGGER IF EXISTS trg_clientes_update_modified ON public.clientes;
CREATE TRIGGER trg_clientes_update_modified
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_clientes_soft_delete ON public.clientes;
CREATE TRIGGER trg_clientes_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Contratos
DROP TRIGGER IF EXISTS trg_contratos_update_modified ON public.contratos;
CREATE TRIGGER trg_contratos_update_modified
    BEFORE UPDATE ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_contratos_soft_delete ON public.contratos;
CREATE TRIGGER trg_contratos_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Documentos
DROP TRIGGER IF EXISTS trg_documentos_update_modified ON public.documentos;
CREATE TRIGGER trg_documentos_update_modified
    BEFORE UPDATE ON public.documentos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_documentos_soft_delete ON public.documentos;
CREATE TRIGGER trg_documentos_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.documentos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Empresas
DROP TRIGGER IF EXISTS trg_empresas_update_modified ON public.empresas;
CREATE TRIGGER trg_empresas_update_modified
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

-- Facturas
DROP TRIGGER IF EXISTS trg_facturas_update_modified ON public.facturas;
CREATE TRIGGER trg_facturas_update_modified
    BEFORE UPDATE ON public.facturas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_facturas_soft_delete ON public.facturas;
CREATE TRIGGER trg_facturas_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.facturas
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Lineas_factura
DROP TRIGGER IF EXISTS trg_lineas_factura_update_modified ON public.lineas_factura;
CREATE TRIGGER trg_lineas_factura_update_modified
    BEFORE UPDATE ON public.lineas_factura
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

-- Puntos_suministro
DROP TRIGGER IF EXISTS trg_puntos_suministro_update_modified ON public.puntos_suministro;
CREATE TRIGGER trg_puntos_suministro_update_modified
    BEFORE UPDATE ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_puntos_suministro_soft_delete ON public.puntos_suministro;
CREATE TRIGGER trg_puntos_suministro_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Tarifas
DROP TRIGGER IF EXISTS trg_tarifas_update_modified ON public.tarifas;
CREATE TRIGGER trg_tarifas_update_modified
    BEFORE UPDATE ON public.tarifas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

-- Usuarios_app
DROP TRIGGER IF EXISTS trg_usuarios_app_update_modified ON public.usuarios_app;
CREATE TRIGGER trg_usuarios_app_update_modified
    BEFORE UPDATE ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

DROP TRIGGER IF EXISTS trg_usuarios_app_soft_delete ON public.usuarios_app;
CREATE TRIGGER trg_usuarios_app_soft_delete
    BEFORE UPDATE OF eliminado_en ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_soft_delete();

-- Facturacion_clientes
DROP TRIGGER IF EXISTS trg_facturacion_clientes_update_modified ON public.facturacion_clientes;
CREATE TRIGGER trg_facturacion_clientes_update_modified
    BEFORE UPDATE ON public.facturacion_clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_timestamp();

-- ============================================================================
-- SECCIÓN 14: TRIGGER PARA CAPTURAR CREADO_POR EN INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Establecer creado_por si no está definido
    IF NEW.creado_por IS NULL THEN
        NEW.creado_por := auth.uid();
    END IF;
    
    -- Establecer creado_en si existe la columna y no está definido
    IF TG_TABLE_NAME IN ('documentos', 'facturas', 'lineas_factura', 'tarifas', 
                         'comparativas', 'consumos', 'contactos_cliente', 
                         'notificaciones', 'remesas') THEN
        IF NEW.creado_en IS NULL THEN
            NEW.creado_en := current_timestamp;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear triggers para INSERT en todas las tablas
DROP TRIGGER IF EXISTS trg_clientes_set_created ON public.clientes;
CREATE TRIGGER trg_clientes_set_created
    BEFORE INSERT ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_contratos_set_created ON public.contratos;
CREATE TRIGGER trg_contratos_set_created
    BEFORE INSERT ON public.contratos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_documentos_set_created ON public.documentos;
CREATE TRIGGER trg_documentos_set_created
    BEFORE INSERT ON public.documentos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_empresas_set_created ON public.empresas;
CREATE TRIGGER trg_empresas_set_created
    BEFORE INSERT ON public.empresas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_facturas_set_created ON public.facturas;
CREATE TRIGGER trg_facturas_set_created
    BEFORE INSERT ON public.facturas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_lineas_factura_set_created ON public.lineas_factura;
CREATE TRIGGER trg_lineas_factura_set_created
    BEFORE INSERT ON public.lineas_factura
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_puntos_suministro_set_created ON public.puntos_suministro;
CREATE TRIGGER trg_puntos_suministro_set_created
    BEFORE INSERT ON public.puntos_suministro
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_tarifas_set_created ON public.tarifas;
CREATE TRIGGER trg_tarifas_set_created
    BEFORE INSERT ON public.tarifas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_usuarios_app_set_created ON public.usuarios_app;
CREATE TRIGGER trg_usuarios_app_set_created
    BEFORE INSERT ON public.usuarios_app
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_facturacion_clientes_set_created ON public.facturacion_clientes;
CREATE TRIGGER trg_facturacion_clientes_set_created
    BEFORE INSERT ON public.facturacion_clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_created_by();

-- ============================================================================
-- SECCIÓN 15: VISTAS PARA EXCLUIR REGISTROS ELIMINADOS
-- ============================================================================
-- Vistas que automáticamente excluyen registros con soft delete

CREATE OR REPLACE VIEW public.v_clientes_activos AS
SELECT * FROM public.clientes WHERE eliminado_en IS NULL;

CREATE OR REPLACE VIEW public.v_contratos_activos AS
SELECT * FROM public.contratos WHERE eliminado_en IS NULL;

CREATE OR REPLACE VIEW public.v_puntos_suministro_activos AS
SELECT * FROM public.puntos_suministro WHERE eliminado_en IS NULL;

CREATE OR REPLACE VIEW public.v_documentos_activos AS
SELECT * FROM public.documentos WHERE eliminado_en IS NULL;

CREATE OR REPLACE VIEW public.v_facturas_activas AS
SELECT * FROM public.facturas WHERE eliminado_en IS NULL;

CREATE OR REPLACE VIEW public.v_usuarios_app_activos AS
SELECT * FROM public.usuarios_app WHERE eliminado_en IS NULL;

-- ============================================================================
-- SECCIÓN 16: FUNCIÓN DE AUDITORÍA PARA RECUPERAR REGISTROS ELIMINADOS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restaurar_registro_eliminado(
    p_tabla TEXT,
    p_id UUID,
    p_motivo TEXT DEFAULT 'Restauración solicitada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Verificar que el usuario es administrador
    IF NOT EXISTS (
        SELECT 1 FROM public.usuarios_app 
        WHERE user_id = v_user_id AND rol = 'administrador'
    ) THEN
        RAISE EXCEPTION 'Solo administradores pueden restaurar registros eliminados';
    END IF;

    -- Ejecutar restauración según la tabla
    EXECUTE format(
        'UPDATE public.%I SET eliminado_en = NULL, eliminado_por = NULL, 
         modificado_en = current_timestamp, modificado_por = $1
         WHERE id = $2 AND eliminado_en IS NOT NULL
         RETURNING to_jsonb(%I.*)',
        p_tabla, p_tabla
    )
    INTO v_result
    USING v_user_id, p_id;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Registro no encontrado o no estaba eliminado';
    END IF;

    -- Registrar en auditoría
    INSERT INTO audit.logged_actions (
        schema_name, table_name, action, new_data, 
        user_id, reason, metadata
    ) VALUES (
        'public', p_tabla, 'U', v_result,
        v_user_id, p_motivo,
        jsonb_build_object('operation', 'RESTORE', 'restored_at', current_timestamp)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'restored_record', v_result,
        'restored_by', v_user_id,
        'restored_at', current_timestamp
    );
END;
$$;

COMMENT ON FUNCTION public.restaurar_registro_eliminado IS 
'Permite a administradores restaurar registros con soft delete.
Registra la operación en audit.logged_actions.';

-- Función auxiliar para limpiar
DROP FUNCTION IF EXISTS add_column_if_not_exists(TEXT, TEXT, TEXT);

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
/*
-- Verificar columnas agregadas
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('creado_por', 'modificado_en', 'modificado_por', 
                      'eliminado_en', 'eliminado_por', 'version')
ORDER BY table_name, column_name;

-- Verificar triggers creados
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verificar vistas creadas
SELECT table_name FROM information_schema.views WHERE table_schema = 'public';
*/
