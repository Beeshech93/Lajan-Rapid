/** Errores tipados del módulo de tarjetas. */

export class CardError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = code;
    this.code = code;
  }
}

export class ProviderUnavailableError extends CardError {
  constructor(message = "El proveedor emisor no está disponible.") {
    super("PROVIDER_UNAVAILABLE", message);
  }
}
export class AuthenticationError extends CardError {
  constructor(message = "Credenciales del emisor inválidas.") {
    super("AUTHENTICATION_ERROR", message);
  }
}
export class CardCreationError extends CardError {
  constructor(message = "No se pudo emitir la tarjeta.") {
    super("CARD_CREATION_ERROR", message);
  }
}
export class CardNotFoundError extends CardError {
  constructor(message = "Tarjeta no encontrada.") {
    super("CARD_NOT_FOUND", message);
  }
}
export class TransactionDeclinedError extends CardError {
  constructor(message = "Transacción rechazada.") {
    super("TRANSACTION_DECLINED", message);
  }
}
export class WebhookValidationError extends CardError {
  constructor(message = "Firma de webhook inválida.") {
    super("WEBHOOK_VALIDATION_ERROR", message);
  }
}
export class InsufficientFundsError extends CardError {
  constructor(message = "Saldo insuficiente en la billetera.") {
    super("INSUFFICIENT_FUNDS", message);
  }
}
export class KycRequiredError extends CardError {
  constructor(message = "Necesitas la verificación de identidad aprobada.") {
    super("KYC_REQUIRED", message);
  }
}
export class CountryNotSupportedError extends CardError {
  constructor(message = "País no soportado por el programa de tarjetas.") {
    super("COUNTRY_NOT_SUPPORTED", message);
  }
}
