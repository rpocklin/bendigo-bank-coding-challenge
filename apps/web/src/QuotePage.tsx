import {
  en,
  parseQuoteRequest,
  parseQuoteResponse,
  sentence,
  type DetailCode,
  type ErrorBody,
  type QuoteResponse,
} from "@quote/contract";
import { useState, type FormEvent } from "react";
import { displayDecimal } from "./format.js";

type Field = "loanAmount" | "loanTermInMonths" | "riskBand";

const locale =
  typeof navigator === "undefined" ? "en-AU" : navigator.language || "en-AU";

export function QuotePage() {
  const [loanAmount, setLoanAmount] = useState("");
  const [term, setTerm] = useState("");
  const [riskBand, setRiskBand] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<Field, string>>
  >({});
  const [alertMessage, setAlertMessage] = useState<string | undefined>();
  const [quote, setQuote] = useState<QuoteResponse | undefined>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setAlertMessage(undefined);
    setQuote(undefined);
    const parsed = parseQuoteRequest({
      currency: "AUD",
      loanAmount,
      loanTermInMonths: term === "" ? undefined : Number(term),
      riskBand: riskBand === "" ? undefined : riskBand,
    });
    if (!parsed.ok) {
      setFieldErrors(fieldMessages(parsed.error));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const response = await fetch("/v1/quotes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": locale,
          "x-correlation-id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          currency: "AUD",
          loanAmount,
          loanTermInMonths: parsed.value.loanTermInMonths,
          riskBand: parsed.value.riskBand,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setAlertMessage(
          withRetry(
            lookup(body as ErrorBody),
            response.headers?.get("retry-after") ?? null,
          ),
        );
        return;
      }
      const parsedQuote = parseQuoteResponse(body);
      if (!parsedQuote.ok) {
        setAlertMessage(en.vendor_unavailable);
        return;
      }
      setQuote(parsedQuote.value);
    } catch {
      setAlertMessage(en.vendor_unavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <a className="skip" href="#quote-form">
        Skip to quote form
      </a>
      <main className="page">
        <p className="mark">Bendigo Bank</p>
        <h1>Commission quote</h1>
        <form
          id="quote-form"
          onSubmit={onSubmit}
          aria-busy={loading}
          noValidate
        >
          <div>
            <label htmlFor="currency">Currency</label>
            <p id="currency" className="currency">
              AUD
            </p>
          </div>
          <div>
            <label htmlFor="loanAmount">Loan amount</label>
            <div className="amount">
              <span>AUD</span>
              <input
                id="loanAmount"
                name="loanAmount"
                inputMode="decimal"
                autoComplete="off"
                value={loanAmount}
                aria-invalid={fieldErrors.loanAmount ? true : undefined}
                aria-describedby={
                  fieldErrors.loanAmount ? "loanAmount-error" : undefined
                }
                onChange={(event) => setLoanAmount(event.target.value)}
              />
            </div>
            {fieldErrors.loanAmount ? (
              <p id="loanAmount-error" className="field-error">
                {fieldErrors.loanAmount}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="loanTermInMonths">Loan term in months</label>
            <input
              id="loanTermInMonths"
              name="loanTermInMonths"
              inputMode="numeric"
              value={term}
              aria-invalid={fieldErrors.loanTermInMonths ? true : undefined}
              aria-describedby={
                fieldErrors.loanTermInMonths ? "term-error" : undefined
              }
              onChange={(event) => setTerm(event.target.value)}
            />
            {fieldErrors.loanTermInMonths ? (
              <p id="term-error" className="field-error">
                {fieldErrors.loanTermInMonths}
              </p>
            ) : null}
          </div>
          <fieldset className="choices">
            <legend>Risk band</legend>
            {(["LOW", "MEDIUM", "HIGH"] as const).map((band) => (
              <label className="choice" key={band}>
                <input
                  type="radio"
                  name="riskBand"
                  value={band}
                  checked={riskBand === band}
                  onChange={() => setRiskBand(band)}
                />
                {band === "LOW" ? "Low" : band === "MEDIUM" ? "Medium" : "High"}
              </label>
            ))}
            {fieldErrors.riskBand ? (
              <p className="field-error">{fieldErrors.riskBand}</p>
            ) : null}
          </fieldset>
          <section className="disclaimer">
            <h2>Things you should know</h2>
            <p>This figure is a staff quote, not an offer to a customer.</p>
          </section>
          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : null}
            {loading ? "Generating quote" : "Generate quote"}
          </button>
        </form>
        {alertMessage ? (
          <div className="alert" role="alert">
            {alertMessage}
          </div>
        ) : null}
        {quote ? (
          <section className="result" aria-live="polite">
            <h2>Quote</h2>
            <p className="figure">
              {quote.currency} {displayDecimal(quote.totalCommission, locale)}
            </p>
            <p>Rate {displayDecimal(quote.commissionRate, locale)} percent</p>
            <p>Quote id {quote.quoteId}</p>
          </section>
        ) : null}
      </main>
    </>
  );
}

function fieldMessages(error: ErrorBody): Partial<Record<Field, string>> {
  const messages: Partial<Record<Field, string>> = {};
  for (const detail of error.details ?? []) {
    if (
      detail.field === "loanAmount" ||
      detail.field === "loanTermInMonths" ||
      detail.field === "riskBand"
    ) {
      messages[detail.field] = sentence(detail.code, detail.params);
    }
  }
  return messages;
}

function withRetry(message: string, retryAfter: string | null): string {
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return `${message} Retry after ${retryAfter} seconds.`;
  }
  return message;
}

function lookup(error: ErrorBody): string {
  const detail = error.details?.[0];
  if (detail && detail.code in en) {
    return sentence(detail.code as DetailCode, detail.params);
  }
  if (error.code in en) {
    return en[error.code];
  }
  return error.message;
}
