# 🔐 Migración Cifrado en Reposo - OpenEnergies CRM

## Instrucciones de Ejecución

**IMPORTANTE:** Ejecutar los scripts EN ORDEN en el SQL Editor de Supabase.

### Orden de Ejecución

1. `01_crear_clave_vault.sql` - Crear clave maestra en Vault
2. `02_infraestructura_base.sql` - Schema private y función get_encryption_key
3. `03_tabla_datos_cifrados.sql` - Tabla datos_sensibles_cifrados con RLS
4. `04_funciones_cifrado.sql` - Funciones guardar/obtener datos sensibles
5. `05_trigger_clientes.sql` - Trigger automático para cifrar clientes
6. `06_migrar_datos_existentes.sql` - Migrar los 87 clientes actuales
7. `07_enmascarar_originales.sql` - Enmascarar datos en tablas originales
8. `08_integracion_anonimizacion.sql` - Integrar con soft delete/GDPR
9. `09_limpieza_sistema_antiguo.sql` - Eliminar funciones/tablas obsoletas

### Pre-requisitos

- Tener acceso al SQL Editor de Supabase
- Backup de la base de datos antes de ejecutar
- Extensiones requeridas ya instaladas: pgcrypto, supabase_vault

### Verificación Post-Migración

Después de ejecutar todos los scripts, verificar con:
```sql
-- Verificar datos cifrados
SELECT COUNT(*) FROM datos_sensibles_cifrados;

-- Verificar datos enmascarados
SELECT id, nombre, dni, email, telefonos, numero_cuenta 
FROM clientes WHERE eliminado_en IS NULL LIMIT 5;

-- Verificar función de descifrado
SELECT obtener_dato_sensible('cliente', '<uuid_cliente>', 'dni');
```

---
*Fecha: 28 Enero 2026*
*Normativas: GDPR Art. 32, ISO 27001, NIS2, SOC 2*
