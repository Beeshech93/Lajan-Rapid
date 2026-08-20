# Cumplimiento PCI DSS — Lajan Rapid

## Principio

Lajan Rapid **no fabrica ni almacena** PAN, CVV, BIN ni pistas magnéticas.
La emisión real la hace un proveedor autorizado con BIN sponsor.

## Qué se guarda en la base de datos

Permitido: marca, `last4`, mes/año de vencimiento, estado, etiqueta,
`provider`, `provider_card_id` (referencia opaca), límites e historial.

Prohibido: número completo (PAN), CVV/CVC, PIN, datos de banda o chip,
credenciales del titular en el emisor.

## Datos sensibles en pantalla

- Se solicitan al emisor en tiempo real desde el servidor (`cards.server.ts`).
- Nunca se registran en logs, ni se cachean, ni se guardan en la base.
- Solo el dueño de la tarjeta autenticado puede pedirlos; se ocultan en 60 s.
- Las respuestas del emisor viajan por HTTPS y no llevan cabecera de caché
  pública.

## Controles operativos

- Credenciales cifradas en `integration_credentials`, escritura solo admin.
- Row Level Security en `virtual_cards`, `card_limits` y `card_transactions`.
- Emisión y controles pasan por funciones de servidor autenticadas; el cliente
  no habla directamente con el emisor.
- KYC aprobado obligatorio antes de emitir (control AML básico).
- Toda acción de tarjeta queda registrada con usuario y fecha.

## Alcance

Al no tocar datos de titular de tarjeta, el alcance PCI se limita a
**SAQ A** (redirección/servicio del proveedor). Cualquier cambio que haga
pasar el PAN por servidores propios amplía el alcance a SAQ D y requiere
revisión formal antes de implementarse.
