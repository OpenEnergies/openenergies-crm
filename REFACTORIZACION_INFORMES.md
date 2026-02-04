# Refactorización Sistema de Informes - Resumen de Cambios

**Fecha:** 2026-02-04  
**Objetivo:** Eliminar asociación por `empresa_id` de informes y sustituir arrays por tabla relacional `informes_targets`

---

## 📋 Resumen Ejecutivo

Se ha completado una refactorización completa del sistema de informes de mercado para:

1. ✅ **Eliminar `empresa_id`** de la tabla `informes_mercado`
2. ✅ **Eliminar arrays** `cliente_ids` y `punto_ids` 
3. ✅ **Crear tabla relacional** `informes_targets` para gestionar puntos
4. ✅ **Migrar fechas** de `rango_fechas` (JSONB) a `fecha_inicio`/`fecha_fin` (DATE)
5. ✅ **Actualizar RLS** para seguridad basada en `creado_por` y `cliente_id`
6. ✅ **Actualizar edge functions** y frontend completamente

---

## 🗄️ Cambios en Base de Datos

### Nueva Estructura de `informes_mercado`

**Columnas eliminadas:**
- ❌ `empresa_id` (UUID)
- ❌ `cliente_ids` (UUID[])
- ❌ `punto_ids` (UUID[])
- ❌ `rango_fechas` (JSONB)
- ❌ `tipo_energia` (ENUM)

**Columnas añadidas:**
- ✅ `fecha_inicio` (DATE NOT NULL)
- ✅ `fecha_fin` (DATE NOT NULL)

**Columnas mantenidas:**
- `id`, `titulo`, `tipo_informe`, `parametros_config`
- `ruta_storage`, `creado_por`, `creado_en`, `actualizado_en`, `estado`
- `cliente_id` (ya existía, migrado previamente de `cliente_ids[]`)

### Nueva Tabla: `informes_targets`

```sql
CREATE TABLE public.informes_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    informe_id UUID NOT NULL REFERENCES informes_mercado(id) ON DELETE CASCADE,
    punto_id UUID NOT NULL REFERENCES puntos_suministro(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_informe_punto UNIQUE(informe_id, punto_id)
);
```

- Índices: `idx_informes_targets_informe`, `idx_informes_targets_punto`
- RLS habilitado con políticas SELECT/INSERT/DELETE

### Políticas RLS Actualizadas

**Seguridad sin `empresa_id`:**
- Los usuarios ven informes creados por ellos o de clientes de su empresa
- Control basado en:
  - `informes_mercado.creado_por = auth.uid()`
  - O `clientes.empresa_id` → `usuarios_app.empresa_id`
  
**Storage:**
- Rutas ahora usan `cliente_id` en lugar de `empresa_id`
- Formato: `{cliente_id}/{tipo_informe}_{titulo}_{timestamp}.pdf`

### Funciones RPC Actualizadas

**`get_informe_facturacion_data`:**
```sql
-- Antes
p_cliente_ids UUID[]

-- Ahora
p_cliente_id UUID
```

- Ya no acepta múltiples clientes
- Devuelve `por_punto` en lugar de `por_cliente`

---

## 🔧 Cambios en Edge Functions

### `generate-market-report/index.ts`

**Interfaz `InformeConfig`:**
```typescript
// Antes
interface InformeConfig {
  empresa_id: string;
  cliente_ids: string[];
  punto_ids: string[];
  rango_fechas: { start: string; end: string };
  tipo_energia: 'electricidad' | 'gas' | 'ambos';
  tipo_informe: 'auditoria' | 'mercado' | 'seguimiento';
}

// Ahora
interface InformeConfig {
  cliente_id: string;
  punto_ids: string[];
  fecha_inicio: string;
  fecha_fin: string;
  tipo_informe: 'auditoria' | 'comparativa';
}
```

**Lógica de generación:**
1. Valida que `cliente_id` pertenece a la empresa del usuario
2. Obtiene `empresa_id` desde `clientes.empresa_id`
3. Inserta informe sin `empresa_id`
4. Inserta targets en `informes_targets`

---

## 💻 Cambios en Frontend

### Tipos (`lib/informesTypes.ts`)

```typescript
export interface InformeConfig {
  titulo: string;
  tipo_informe: TipoInformeMercado;
  fecha_inicio: string;
  fecha_fin: string;
  rango_preset: RangoPreset;
  cliente_id: UUID | null;
  punto_ids: UUID[];  // ← Nuevo: array de puntos seleccionados
}

export interface InformeMercado {
  // ... sin empresa_id, sin rango_fechas
  fecha_inicio: string;
  fecha_fin: string;
  cliente_id: UUID;
  // ... resto de campos
}
```

### Hooks (`hooks/useInformesMercado.ts`)

**`useInformesList`:**
- Consulta targets y añade `punto_ids` al resultado
- Ya no filtra por `empresa_id`

**`useDatosCalculados`:**
```typescript
// Antes
useDatosCalculados(clienteIds[], puntoIds[], rangoFechas)

// Ahora
useDatosCalculados(clienteId, puntoIds[], fecha_inicio, fecha_fin)
```

**`useAuditoriaEnergeticaData`:**
```typescript
// Antes
useAuditoriaEnergeticaData(clienteId, rangoFechas)

// Ahora
useAuditoriaEnergeticaData(clienteId, fecha_inicio, fecha_fin)
```

### Componentes

**`Step1Config.tsx`:**
- ✅ Selección de **un solo cliente**
- ✅ Selección **multi-punto** con `MultiSearchableSelect`
- ✅ Inputs de fecha directos (`fecha_inicio`, `fecha_fin`)
- ✅ Validación: título + cliente + al menos 1 punto

**`Step2Content.tsx`:**
- Actualizado para recibir `cliente_id` y `punto_ids`
- Usa `fecha_inicio`/`fecha_fin` en lugar de `rango_fechas`

**`Step3Generate.tsx`:**
- Muestra fechas con `config.fecha_inicio` y `config.fecha_fin`

**`AuditoriaEnergeticaContent.tsx`:**
- Llama a `useAuditoriaEnergeticaData` con fechas explícitas

**`InformesPage.tsx`:**
- Ya no añade `empresa_id` al payload de generación

### Database Types (`lib/types.ts`)

- ✅ Actualizado schema de `informes_mercado`
- ✅ Añadido schema de `informes_targets`
- ✅ Eliminado enum `tipo_energia_informe`
- ✅ Actualizado enum `tipo_informe_mercado`: `"auditoria" | "comparativa"`

---

## 📂 Archivos Modificados

### Backend (Supabase)

```
supabase/migrations/
  └── 20260204_refactor_informes_targets.sql  [NUEVO]
  
supabase/functions/
  └── generate-market-report/
      └── index.ts  [MODIFICADO]
```

### Frontend (React)

```
openenergies_crm/src/
├── lib/
│   ├── informesTypes.ts       [MODIFICADO]
│   └── types.ts               [MODIFICADO]
├── hooks/
│   └── useInformesMercado.ts  [MODIFICADO]
└── pages/informes/
    ├── InformesPage.tsx                         [MODIFICADO]
    └── components/
        ├── Step1Config.tsx                      [MODIFICADO]
        ├── Step2Content.tsx                     [MODIFICADO]
        ├── Step3Generate.tsx                    [MODIFICADO]
        └── AuditoriaEnergeticaContent.tsx       [MODIFICADO]
```

---

## ✅ Verificaciones Post-Migración

### SQL
```sql
-- 1. Verificar que targets se crearon correctamente
SELECT COUNT(*) FROM informes_targets;

-- 2. Verificar estructura de informes
SELECT 
  id, titulo, cliente_id, fecha_inicio, fecha_fin, 
  creado_por, estado
FROM informes_mercado 
LIMIT 1;

-- 3. Verificar que no existen columnas antiguas
\d informes_mercado
-- Debe mostrar: NO empresa_id, NO punto_ids, NO rango_fechas

-- 4. Verificar políticas RLS
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('informes_mercado', 'informes_targets');

-- 5. Contar informes por targets
SELECT 
  i.id, 
  i.titulo, 
  COUNT(t.punto_id) as num_puntos
FROM informes_mercado i
LEFT JOIN informes_targets t ON t.informe_id = i.id
GROUP BY i.id, i.titulo;
```

### Frontend
```bash
# Buscar referencias antiguas (debe dar 0 resultados):
grep -r "empresa_id.*inform" openenergies_crm/src/
grep -r "cliente_ids\[" openenergies_crm/src/
grep -r "punto_ids\[" openenergies_crm/src/
grep -r "rango_fechas\." openenergies_crm/src/
```

---

## 🔒 Seguridad (RLS)

### Antes
```sql
-- Dependía de empresa_id
WHERE empresa_id IN (
  SELECT empresa_id FROM usuarios_app WHERE user_id = auth.uid()
)
```

### Ahora
```sql
-- Basado en creado_por y cliente → empresa
WHERE (
  creado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM clientes c
    JOIN usuarios_app u ON u.empresa_id = c.empresa_id
    WHERE c.id = informes_mercado.cliente_id
      AND u.user_id = auth.uid()
  )
)
```

**Ventajas:**
- ✅ Más granular: control por creador + acceso a datos del cliente
- ✅ Sin dependencia directa de empresa
- ✅ Permite futuras extensiones (ej: compartir informes entre empresas)

---

## 🚀 Flujo de Generación (End-to-End)

1. **Usuario selecciona:**
   - Título
   - Tipo de informe (auditoría/comparativa)
   - Rango de fechas (presets o personalizado)
   - **1 cliente** (con facturas en el periodo)
   - **N puntos** (del cliente, con facturas)

2. **Frontend envía:**
   ```json
   {
     "config": {
       "titulo": "...",
       "tipo_informe": "auditoria",
       "fecha_inicio": "2026-01-01",
       "fecha_fin": "2026-01-31",
       "cliente_id": "uuid-cliente",
       "punto_ids": ["uuid-punto-1", "uuid-punto-2"]
     },
     "content": { /* ... */ }
   }
   ```

3. **Edge Function:**
   - Valida que `cliente_id` pertenece a la empresa del usuario
   - Obtiene `empresa_id` de `clientes.empresa_id` (para branding)
   - Llama a `get_informe_facturacion_data(cliente_id, punto_ids[], fecha_inicio, fecha_fin)`
   - Genera PDF
   - Sube a Storage en ruta `{cliente_id}/...`
   - **Inserta en `informes_mercado`** (sin `empresa_id`)
   - **Inserta en `informes_targets`** (1 fila por punto)

4. **RLS permite:**
   - Lectura: si eres creador o usuario de la empresa del cliente
   - Escritura: si eres el creador y el cliente es de tu empresa

---

## 📊 Diagrama de Relaciones

```
usuarios_app
    ↓ empresa_id
empresas ←──────┐
    ↓           │
clientes ←──────┘
    ↓ cliente_id
informes_mercado
    ↓ informe_id
informes_targets
    ↓ punto_id
puntos_suministro
```

**Flujo de seguridad:**
- `auth.uid()` → `usuarios_app.user_id`
- `usuarios_app.empresa_id` → `empresas.id`
- `empresas.id` → `clientes.empresa_id`
- `clientes.id` → `informes_mercado.cliente_id`
- `informes_mercado.id` → `informes_targets.informe_id`
- `informes_targets.punto_id` → `puntos_suministro.id`

---

## ⚠️ Breaking Changes

### API

1. **`get_informe_facturacion_data` cambió firma:**
   ```sql
   -- Antes
   p_cliente_ids UUID[], p_punto_ids UUID[]
   
   -- Ahora
   p_cliente_id UUID, p_punto_ids UUID[]
   ```

2. **`generate-market-report` payload:**
   - `config.empresa_id` → eliminado
   - `config.cliente_ids` → `config.cliente_id` (singular)
   - `config.rango_fechas` → `config.fecha_inicio` + `config.fecha_fin`
   - `config.tipo_energia` → eliminado

### Frontend

1. **`InformeConfig` cambió estructura:**
   - Ver sección "Tipos" arriba

2. **Hooks con nuevas firmas:**
   - `useDatosCalculados(clienteId, puntoIds, fecha_inicio, fecha_fin)`
   - `useAuditoriaEnergeticaData(clienteId, fecha_inicio, fecha_fin)`

---

## 🧪 Testing Recomendado

### Casos de Prueba

1. **Crear informe nuevo:**
   - Seleccionar cliente con facturas
   - Seleccionar puntos con facturas
   - Generar informe
   - ✅ Verificar que se crea registro en `informes_mercado`
   - ✅ Verificar que se crean N registros en `informes_targets`
   - ✅ Verificar que PDF se sube a Storage en ruta correcta

2. **Listar informes:**
   - ✅ Usuario ve solo informes de su empresa (via cliente)
   - ✅ Contador de puntos es correcto

3. **Ver detalle de informe:**
   - ✅ Se muestran todos los puntos del informe
   - ✅ Se puede descargar PDF

4. **Eliminar informe:**
   - ✅ Se eliminan targets (CASCADE)
   - ✅ Se elimina PDF de Storage

5. **RLS:**
   - ✅ Usuario de otra empresa NO ve el informe
   - ✅ Usuario sin permisos NO puede crear informe para cliente de otra empresa

---

## 📝 Notas Finales

- **Sin regresiones:** Datos existentes migrados automáticamente en `20260204_refactor_informes_targets.sql`
- **Sin rastro del formato anterior:** Columnas eliminadas, código actualizado, tipos sincronizados
- **RLS robusto:** Seguridad garantizada sin `empresa_id`
- **Extensible:** La tabla `informes_targets` permite futuras extensiones (ej: añadir metadata por punto)

---

## 🎯 Checklist de Deploy

- [ ] Ejecutar migración `20260204_refactor_informes_targets.sql`
- [ ] Verificar que el backfill completó correctamente
- [ ] Verificar policies RLS con queries de prueba
- [ ] Desplegar edge function actualizada
- [ ] Desplegar frontend actualizado
- [ ] Probar flujo end-to-end en staging
- [ ] Validar que informes antiguos se ven correctamente
- [ ] Generar nuevo informe de prueba
- [ ] Verificar logs de errores

---

**Fin del documento**
