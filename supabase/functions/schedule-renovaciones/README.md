# schedule-renovaciones

Crea registros en `public.notificaciones` para contratos con `aviso_renovacion=true` y `fecha_aviso`.

- **Invocación**: `POST` a la función con JWT de usuario en `Authorization: Bearer <token>` (opcional).
- **Query param**: `?mode=today` (por defecto) o `?mode=pending` (>= hoy).
- **Destinatarios**: se incluyen `c.moreno@openenergies.es` y `javier@openenergies.es` por requisito.

> El envío de correos no se hace aquí. Esta función **agenda** la notificación; otro proceso puede consumir `notificaciones` con estado `pendiente` y enviar el email.
