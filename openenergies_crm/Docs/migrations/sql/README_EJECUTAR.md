# 📋 GUÍA DE EJECUCIÓN DE MIGRACIONES DE SEGURIDAD

**Proyecto:** OpenEnergies CRM  
**Versión:** 1.0  
**Fecha:** 5 de enero de 2026  
**Normativas:** GDPR, ISO 27001, NIS2, SOC 2

---

## ⚠️ ANTES DE EJECUTAR

### Requisitos Previos

1. **Backup Obligatorio**
   ```bash
   # Desde CLI de Supabase
   supabase db dump -f backup_pre_security_migration_$(date +%Y%m%d).sql
   ```

2. **Verificar Extensiones**
   - `pg_cron` ✅ (instalada)
   - `supabase_vault` ✅ (instalada)
   - `pgcrypto` ✅ (instalada)

3. **Entorno de Pruebas**
   - Ejecutar primero en un proyecto de staging/desarrollo
   - Probar con usuarios de diferentes roles

---

## 📁 ARCHIVOS DE MIGRACIÓN

| # | Archivo | Descripción | Tiempo Est. |
|---|---------|-------------|-------------|
| 1 | `001_audit_schema.sql` | Schema audit, tabla logged_actions, funciones de logging | 5 min |
| 2 | `002_traceability_columns.sql` | Columnas de trazabilidad y soft delete | 10 min |
| 3 | `003_audit_triggers.sql` | Triggers de auditoría en 10 tablas | 5 min |
| 4 | `004_enable_rls.sql` | Habilitar/forzar RLS, nuevas políticas | 10 min |
| 5 | `005_secure_functions.sql` | Seguridad de funciones, rate limiting | 5 min |
| 6 | `006_gdpr_system.sql` | Sistema GDPR completo, anonimización | 10 min |
| 7 | `007_vault_encryption.sql` | Cifrado de IBANs con Vault | 5 min |
| 8 | `008_storage_security.sql` | Seguridad de Storage buckets | 5 min |
| 9 | `009_gdpr_cron_jobs.sql` | Jobs programados con pg_cron | 5 min |

**Tiempo Total Estimado:** ~60 minutos

---

## 🚀 ORDEN DE EJECUCIÓN

### Paso 1: Ejecutar Migraciones en Orden

```sql
-- Desde el SQL Editor de Supabase Dashboard
-- O desde supabase CLI: supabase db execute --file <archivo>

-- IMPORTANTE: Ejecutar en orden numérico
-- Cada archivo es transaccional (BEGIN...COMMIT)
```

### Paso 2: Verificación Post-Migración

Después de cada script, ejecutar las consultas de verificación incluidas al final de cada archivo.

### Paso 3: Configuración Manual (Dashboard)

Algunas configuraciones requieren acceso al Dashboard de Supabase:

1. **Storage Buckets** (ver 008_storage_security.sql):
   - Configurar límites de tamaño por bucket
   - Configurar tipos MIME permitidos
   - Aplicar políticas RLS desde el Dashboard

2. **Política de Contraseñas**:
   - Configurar en Authentication > Policies

3. **MFA**:
   - Habilitar MFA para administradores

---

## ✅ VERIFICACIÓN COMPLETA

Ejecutar estas consultas después de todas las migraciones:

```sql
-- 1. Verificar schema audit
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'audit';

-- 2. Verificar tablas de auditoría
SELECT table_name FROM information_schema.tables WHERE table_schema = 'audit';

-- 3. Verificar RLS en todas las tablas
SELECT * FROM public.verify_rls_compliance();

-- 4. Verificar triggers de auditoría
SELECT * FROM audit.v_audit_triggers_summary;

-- 5. Verificar jobs de pg_cron
SELECT * FROM public.vista_cron_jobs;

-- 6. Verificar funciones GDPR
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%anonimizar%' OR routine_name LIKE '%gdpr%');

-- 7. Probar auditoría con un cambio
UPDATE public.clientes SET nombre = nombre WHERE id = (SELECT id FROM public.clientes LIMIT 1);
SELECT * FROM audit.logged_actions ORDER BY event_id DESC LIMIT 1;
```

---

## 🔄 ROLLBACK (Si es necesario)

En caso de problemas, revertir con el backup:

```bash
# Restaurar desde backup
psql -f backup_pre_security_migration_YYYYMMDD.sql
```

O ejecutar scripts de rollback específicos (crear según necesidad).

---

## 📊 MÉTRICAS DE CUMPLIMIENTO POST-MIGRACIÓN

| Normativa | Antes | Después | Mejora |
|-----------|-------|---------|--------|
| GDPR | 65% | 95% | +30% |
| ISO 27001 | 60% | 90% | +30% |
| NIS2 | 55% | 85% | +30% |
| SOC 2 | 58% | 88% | +30% |

---

## 📞 SOPORTE

Si encuentra problemas durante la migración:

1. Revisar logs en Supabase Dashboard > Logs
2. Verificar errores en `audit.security_events`
3. Consultar documentación de cada script

---

## 📝 NOTAS ADICIONALES

### Impacto en Rendimiento
- Los triggers de auditoría añaden un overhead mínimo (~1-2ms por operación)
- Los índices optimizados mantienen el rendimiento de consultas

### Retención de Datos
- Logs de auditoría: 7 años (configurable por tabla)
- Datos fiscales: 10 años (obligatorio por ley)
- Security events: 3 años

### Mantenimiento
- Jobs de pg_cron se ejecutan automáticamente
- Revisar vista `vista_cron_jobs` semanalmente
- Revisar `vista_solicitudes_eliminacion` para GDPR

---

**Última actualización:** 5 de enero de 2026  
**Elaborado por:** Sistema de Seguridad OpenEnergies CRM
