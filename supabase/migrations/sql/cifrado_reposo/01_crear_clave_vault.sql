-- ============================================================================
-- FASE 1: GENERAR CLAVE MAESTRA PARA VAULT
-- ============================================================================
-- Descripción: Genera una clave AES-256 segura para insertar manualmente en Vault
-- Fecha: 28 Enero 2026
-- Normativas: GDPR Art. 32, ISO 27001 A.10.1, SOC 2 CC6.7
-- ============================================================================

-- Ejecutar este SELECT y copiar el valor generado
-- Luego ir a: Supabase Dashboard → Project Settings → Vault → Add new secret
--   Name: encryption_key_datos_sensibles
--   Secret: <pegar el valor generado>
--   Description: Clave maestra AES-256 para cifrado de datos sensibles (PII). GDPR Art. 32.

SELECT encode(extensions.gen_random_bytes(32), 'hex') AS clave_aes256;

-- ============================================================================
-- VERIFICACIÓN (ejecutar después de crear el secreto en el Dashboard)
-- ============================================================================
-- SELECT id, name, description, created_at FROM vault.secrets WHERE name = 'encryption_key_datos_sensibles';
