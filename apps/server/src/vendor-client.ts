import {
  errorBody,
  parseQuoteResponse,
  type ErrorBody,
  type QuoteRequest,
  type QuoteResponse,
} from "@quote/contract";
import { amountWire } from "@quote/contract";

export type VendorClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export type VendorResult =
  | { ok: true; quote: QuoteResponse }
  | {
      ok: false;
      status: 429 | 500 | 503 | 504;
      error: ErrorBody;
      retryAfter?: string;
    };

export async function requestQuote(
  options: VendorClientOptions,
  request: QuoteRequest,
  correlationId: string,
): Promise<VendorResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL("/v1/quotes", options.baseUrl);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": options.apiKey,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        currency: request.currency,
        loanAmount: amountWire(request.loanAmount),
        loanTermInMonths: request.loanTermInMonths,
        riskBand: request.riskBand,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get("retry-after") ?? undefined;
      return {
        ok: false,
        status: response.status,
        error: errorBody(
          response.status === 429 ? "rate_limited" : "service_unavailable",
        ),
        ...(retryAfter ? { retryAfter } : {}),
      };
    }
    if (!response.ok) {
      return { ok: false, status: 500, error: errorBody("vendor_unavailable") };
    }
    const parsed = parseQuoteResponse(await readJson(response));
    if (!parsed.ok) {
      return { ok: false, status: 500, error: errorBody("vendor_unavailable") };
    }
    return { ok: true, quote: parsed.value };
  } catch (error) {
    if (isTimeout(error)) {
      return { ok: false, status: 504, error: errorBody("vendor_timeout") };
    }
    return { ok: false, status: 500, error: errorBody("vendor_unavailable") };
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
