# Guía: Cifrado en Reposo con Supabase
## Estrategia de Protección de Datos Sensibles (GDPR Art. 32)

---

## 1. Resumen Ejecutivo

Esta guía documenta la estrategia implementada para cifrar datos sensibles (PII) en aplicaciones que usan **Supabase** como backend. El objetivo es cumplir con GDPR Art. 32 que exige "cifrado de datos personales" como medida de seguridad.

**Resultado:** Los datos sensibles se almacenan cifrados en la base de datos. Si alguien accede directamente a la BD (backup, brecha de seguridad), solo verá datos cifrados ilegibles.

---

## 2. El Problema

Supabase ofrece **Supabase Vault** para almacenar secretos, pero tiene limitaciones:

| Característica | Vault Nativo | Nuestra Necesidad |
|----------------|--------------|-------------------|
| Diseñado para | Secretos estáticos (API keys) | Datos dinámicos (DNI, emails) |
| Volumen | Pocos secretos | Miles de registros |
| Acceso | Solo desde Dashboard | Desde triggers/funciones |
| Permisos | Requiere `supabase_admin` | Necesitamos `postgres`/`service_role` |

**Problema técnico:** `vault.create_secret()` requiere permisos de `supabase_admin` que no están disponibles para funciones o triggers de PostgreSQL.

---

## 3. La Solución: Arquitectura Híbrida

### Concepto Clave
> **Vault almacena UNA clave maestra → pgcrypto cifra TODOS los datos**

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE VAULT                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Secret: "encryption_key_datos_sensibles"           │   │
│  │  Value: "clave-AES-256-muy-segura-generada"        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (lectura vía vault.decrypted_secrets)
┌─────────────────────────────────────────────────────────────┐
│              FUNCIÓN: get_encryption_key()                  │
│              (SECURITY DEFINER, schema private)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              FUNCIONES DE CIFRADO (pgcrypto)                │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ guardar_dato_sensible│  │ obtener_dato_sensible│        │
│  │ (INSERT/UPDATE)      │  │ (SELECT/lectura)     │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           TABLA: datos_sensibles_cifrados                   │
│  ┌─────────────┬───────────┬───────┬──────────────────┐    │
│  │ entidad_tipo│ entidad_id│ campo │ valor_cifrado    │    │
│  ├─────────────┼───────────┼───────┼──────────────────┤    │
│  │ cliente     │ uuid-123  │ dni   │ \x0A3B5C7D9E...  │    │
│  │ cliente     │ uuid-123  │ email │ \x1F2E3D4C5B...  │    │
│  │ contrato    │ uuid-456  │ iban  │ \x9A8B7C6D5E...  │    │
│  └─────────────┴───────────┴───────┴──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes de la Solución

### 4.1 Clave de Cifrado en Vault (Manual, una sola vez)

Se crea UNA clave maestra en el Dashboard de Supabase:
- **Nombre:** `encryption_key_datos_sensibles`
- **Valor:** Clave AES-256 segura (mínimo 32 caracteres)
- **Ubicación:** Supabase Dashboard → Project Settings → Vault

Esta clave NUNCA se expone en código ni en logs.

### 4.2 Tabla de Datos Cifrados

Tabla genérica que almacena cualquier dato sensible de cualquier entidad:

```sql
CREATE TABLE datos_sensibles_cifrados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad_tipo TEXT NOT NULL,      -- 'cliente', 'contrato', 'usuario'
    entidad_id UUID NOT NULL,        -- ID del registro original
    campo TEXT NOT NULL,             -- 'dni', 'email', 'iban', etc.
    valor_cifrado BYTEA NOT NULL,    -- Datos cifrados con AES
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(entidad_tipo, entidad_id, campo)
);
```

### 4.3 Función para Leer la Clave (SECURITY DEFINER)

```sql
CREATE OR REPLACE FUNCTION private.get_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER  -- Ejecuta con permisos del owner (postgres)
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT decrypted_secret 
        FROM vault.decrypted_secrets 
        WHERE name = 'encryption_key_datos_sensibles'
    );
END;
$$;
```

### 4.4 Funciones de Cifrado/Descifrado (pgcrypto)

```sql
-- Guardar dato cifrado
CREATE FUNCTION guardar_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT,
    p_valor TEXT
) RETURNS VOID AS $$
    INSERT INTO datos_sensibles_cifrados (entidad_tipo, entidad_id, campo, valor_cifrado)
    VALUES (
        p_entidad_tipo, 
        p_entidad_id, 
        p_campo, 
        pgp_sym_encrypt(p_valor, private.get_encryption_key())
    )
    ON CONFLICT (entidad_tipo, entidad_id, campo) 
    DO UPDATE SET 
        valor_cifrado = pgp_sym_encrypt(p_valor, private.get_encryption_key()),
        updated_at = now();
$$;

-- Leer dato descifrado
CREATE FUNCTION obtener_dato_sensible(
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_campo TEXT
) RETURNS TEXT AS $$
    SELECT pgp_sym_decrypt(valor_cifrado, private.get_encryption_key())::text
    FROM datos_sensibles_cifrados
    WHERE entidad_tipo = p_entidad_tipo 
      AND entidad_id = p_entidad_id 
      AND campo = p_campo;
$$;
```

### 4.5 Triggers Automáticos

Los triggers interceptan INSERT/UPDATE en las tablas originales:

```sql
CREATE TRIGGER trg_cifrar_datos_sensibles
    AFTER INSERT OR UPDATE ON mi_tabla
    FOR EACH ROW
    EXECUTE FUNCTION sync_datos_sensibles();
```

La función del trigger:
1. Lee los campos sensibles del NEW record
2. Los cifra y guarda en `datos_sensibles_cifrados`
3. Pone NULL en los campos originales (opcional pero recomendado)

---

## 5. Flujo de Datos

### Al CREAR/EDITAR un registro:

```
Frontend → INSERT/UPDATE tabla_original → Trigger → guardar_dato_sensible() → tabla_cifrada
                                              ↓
                            Columnas originales quedan en NULL
```

### Al LEER un registro:

```
Frontend → RPC leer_datos_sensibles() → obtener_dato_sensible() → Descifra → Retorna JSON
```

---

## 6. Pasos para Implementar en Nuevo Proyecto

### Paso 1: Crear clave en Vault (Dashboard)
1. Ir a Project Settings → Vault
2. Crear secret `encryption_key_datos_sensibles`
3. Generar clave segura de 32+ caracteres

### Paso 2: Habilitar extensiones
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- supabase_vault ya viene habilitada
```

### Paso 3: Crear schema privado
```sql
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
```

### Paso 4: Crear función get_encryption_key
(Ver sección 4.3)

### Paso 5: Crear tabla datos_sensibles_cifrados
(Ver sección 4.2)

### Paso 6: Crear funciones de cifrado/descifrado
(Ver sección 4.4)

### Paso 7: Identificar campos sensibles por tabla
Ejemplo:
- `clientes`: dni, cif, email, telefonos
- `contratos`: numero_cuenta (IBAN)
- `empleados`: telefono_personal

### Paso 8: Crear triggers por cada tabla
Un trigger por tabla que tenga campos sensibles.

### Paso 9: Crear funciones RPC de lectura
Para que el frontend pueda leer los datos descifrados.

### Paso 10: Actualizar frontend
Cambiar lectura directa de columnas por llamadas RPC.

---

## 7. Consideraciones de Seguridad

### ✅ Buenas Prácticas Implementadas
- Clave almacenada en Vault (nunca en código)
- Funciones con SECURITY DEFINER
- Schema `private` sin acceso público
- Cifrado AES-256 vía pgcrypto
- Columnas originales en NULL después de cifrar

### ⚠️ Limitaciones a Tener en Cuenta
- **Búsqueda:** No puedes hacer `WHERE email LIKE '%@gmail.com'` en datos cifrados
- **Índices:** Los datos cifrados no son indexables
- **Performance:** Pequeño overhead en lectura/escritura
- **Logs de auditoría:** Los logs antiguos pueden tener datos en texto plano

### 🔐 Qué NO Cifrar
- IDs y claves foráneas
- Campos necesarios para JOINs o búsquedas
- Datos ya públicos (nombre de empresa, dirección fiscal)
- Emails de login en `auth.users` (Supabase los necesita)

---

## 8. Datos Típicos a Cifrar (GDPR)

| Categoría | Campos |
|-----------|--------|
| Identificación | DNI, NIE, Pasaporte, CIF |
| Contacto | Email personal, Teléfono, Dirección |
| Financiero | IBAN, Número de cuenta, Tarjeta |
| Salud | Cualquier dato médico |
| Biométrico | Huellas, reconocimiento facial |

---

## 9. Testing y Verificación

### Verificar que el cifrado funciona:
```sql
-- Debe mostrar datos cifrados (bytes)
SELECT * FROM datos_sensibles_cifrados LIMIT 5;

-- Debe mostrar NULL en columnas sensibles
SELECT id, nombre, dni, email FROM clientes LIMIT 5;

-- Debe retornar datos descifrados
SELECT * FROM leer_datos_sensibles_cliente('uuid-del-cliente');
```

### Verificar triggers activos:
```sql
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE 'trg_%vault%';
```

---

## 10. Resumen

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| Almacén de clave | Supabase Vault | Guardar clave maestra de forma segura |
| Cifrado | pgcrypto (AES) | Cifrar/descifrar datos |
| Almacén cifrado | Tabla PostgreSQL | Guardar datos cifrados |
| Automatización | Triggers | Cifrar automáticamente en INSERT/UPDATE |
| Acceso frontend | Funciones RPC | Leer datos descifrados |

**Ventaja principal:** Compatible con cualquier proyecto Supabase sin necesidad de servicios externos o modificar la infraestructura.

---

*Documento generado: Enero 2026*
*Tecnologías: Supabase, PostgreSQL, pgcrypto, Vault*
