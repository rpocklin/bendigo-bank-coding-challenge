export const errorCodes = [
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "service_unavailable",
  "vendor_unavailable",
  "vendor_timeout",
  "internal_error",
] as const;

export const detailCodes = [
  "invalid_amount",
  "invalid_term",
  "invalid_risk_band",
  "invalid_currency",
  "invalid_rate",
  "invalid_commission",
  "invalid_quote_id",
  "unknown_field",
  "missing_body",
  "missing_field",
] as const;

export type ErrorCode = (typeof errorCodes)[number];
export type DetailCode = (typeof detailCodes)[number];
export type CatalogCode = ErrorCode | DetailCode;

export const en: Record<CatalogCode, string> = {
  invalid_request: "The quote request is not valid.",
  unauthorized: "The quote service rejected the credentials.",
  forbidden: "The quote service refused the request.",
  not_found: "No quote route matches this request.",
  rate_limited: "The quote service is busy. Try again shortly.",
  service_unavailable:
    "The quote service is temporarily unavailable. Try again shortly.",
  vendor_unavailable: "The quote service is unavailable. Try again.",
  vendor_timeout: "The quote service took too long to respond.",
  internal_error: "The quote could not be completed.",
  invalid_amount:
    "Enter a loan amount in {currency} with {scale} decimal places.",
  invalid_term: "Enter a whole loan term from 1 to 360 months.",
  invalid_risk_band: "Choose a risk band of low, medium, or high.",
  invalid_currency: "Choose a supported currency.",
  invalid_rate:
    "The commission rate must be a percentage with {scale} decimal places.",
  invalid_commission: "The commission amount is not a valid {currency} value.",
  invalid_quote_id: "The quote id is not valid.",
  unknown_field: "Remove the field {field}.",
  missing_body: "Enter the loan details.",
  missing_field: "Enter {field}.",
};

export type MessageParams = Record<string, string | number>;

export function sentence(code: CatalogCode, params?: MessageParams): string {
  const template = en[code];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? "" : String(value);
  });
}

/** Version 1 has one catalog. Any Accept-Language value resolves to English. */
export function resolveLocale(_acceptLanguage: string | undefined): "en" {
  return "en";
}

export function catalog(locale: "en"): Record<CatalogCode, string> {
  return locale === "en" ? en : en;
}
