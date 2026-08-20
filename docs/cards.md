# Lajan Rapid — Tarjetas virtuales internacionales

## Arquitectura

El módulo de tarjetas usa una interfaz de proveedor conmutable, así se cambia de
Visa a Mastercard (o a sandbox) sin reescribir la aplicación.

```
src/lib/cards/
  card-provider.interface.ts   Contrato común (cardholder, emisión, controles)
  mock.provider.server.ts      Proveedor sandbox (sin datos reales)
  network.provider.server.ts   Visa / Mastercard vía API del emisor
  registry.server.ts           Selección por configuración + estado del programa
  errors.ts                    Errores tipados (KYC, emisión, no encontrada)
src/lib/cards.functions.ts     Server functions (RPC autenticado)
src/lib/cards.server.ts        Proxy de datos sensibles del emisor
src/lib/cards.schemas.ts       Validación Zod de entradas
```

## Configuración (Panel de administración → Tarjetas)

| Clave | Uso |
| --- | --- |
| `CARD_PROVIDER` | `mock`, `visa` o `mastercard` |
| `VISA_ENABLED` / `MASTERCARD_ENABLED` | Habilita la red tras la aprobación del programa |
| `VISA_BASE_URL`, `VISA_API_KEY`, `VISA_USER_ID` | Credenciales Visa |
| `MASTERCARD_BASE_URL`, `MASTERCARD_API_KEY`, `MASTERCARD_CLIENT_ID`, `MASTERCARD_CLIENT_SECRET` | Credenciales Mastercard |
| `CARD_API_BASE_URL`, `CARD_API_KEY`, `CARD_API_SECRET` | Emisor que entrega los datos completos de la tarjeta |

Se guardan cifradas en `integration_credentials`; solo administradores pueden
escribirlas y nunca se exponen al navegador.

## Flujos

1. **Emisión** (`issueCard`): exige KYC `approved`, valida que la billetera sea
   del usuario, crea el cardholder y la tarjeta en el proveedor con clave de
   idempotencia, y guarda solo metadatos (`last4`, vencimiento, marca, estado).
2. **Controles** (`setCardControl`): congelar, desbloquear y terminar. Se aplica
   primero en el proveedor y luego en la base de datos.
3. **Datos completos** (`revealCardDetails`): se piden al emisor en el momento,
   solo para el dueño de la tarjeta, y la interfaz los oculta tras 60 segundos.
4. **Historial**: `card_transactions` con montos, comercio, estado y motivo de
   rechazo.

## Apple Pay / Google Pay

La aplicación no tokeniza por su cuenta. Cuando el programa lo permita, el
proveedor entrega el push-provisioning; la interfaz solo añadirá el botón de
provisión usando el `provider_card_id` ya almacenado.
