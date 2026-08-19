// Implementaciones para emisores reales (Visa / Mastercard).
//
// REQUIERE PROVEEDOR / APROBACIÓN:
// Visa y Mastercard no emiten tarjetas directamente a una aplicación: se
// necesita un BIN sponsor, un issuer processor y/o un program manager.
// Por eso aquí NO se inventan endpoints ni credenciales. Cuando el emisor
// autorizado entregue su documentación oficial, se implementan estos métodos
// con su URL base y su esquema de autenticación reales.

import type {
  CardProvider,
  CardProviderName,
  ProviderCard,
  ProviderTransaction,
} from "./card-provider.interface";
import { ProviderUnavailableError } from "./errors";

function notReady(name: CardProviderName): never {
  throw new ProviderUnavailableError(
    `El programa ${name.toUpperCase()} aún no está habilitado. REQUIERE PROVEEDOR / APROBACIÓN: ` +
      "BIN sponsor, issuer processor y credenciales de producción.",
  );
}

function buildNetworkProvider(name: CardProviderName): CardProvider {
  return {
    name,
    live: false,
    async createCardholder() {
      return notReady(name);
    },
    async createVirtualCard(): Promise<ProviderCard> {
      return notReady(name);
    },
    async getCard(): Promise<ProviderCard> {
      return notReady(name);
    },
    async freezeCard() {
      return notReady(name);
    },
    async unfreezeCard() {
      return notReady(name);
    },
    async terminateCard() {
      return notReady(name);
    },
    async getCardTransactions(): Promise<ProviderTransaction[]> {
      return notReady(name);
    },
    async updateCardLimits() {
      return notReady(name);
    },
  };
}

export const visaCardProvider = buildNetworkProvider("visa");
export const mastercardCardProvider = buildNetworkProvider("mastercard");
