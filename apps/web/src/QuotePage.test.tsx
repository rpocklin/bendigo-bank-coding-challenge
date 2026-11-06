import { en } from "@quote/contract";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuotePage } from "./QuotePage.js";

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Loan amount"), "10000.00");
  await user.type(screen.getByLabelText("Loan term in months"), "360");
  await user.click(screen.getByLabelText("High"));
}

describe("quote form", () => {
  it("does not call the network for an empty amount, a short amount, or a missing band", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<QuotePage />);
    const warning = screen.getByRole("heading", {
      name: "Things you should know",
    });
    const submit = screen.getByRole("button", { name: "Generate quote" });
    expect(
      warning.compareDocumentPosition(submit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(submit);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        en.invalid_amount.replace("{currency}", "AUD").replace("{scale}", "2"),
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Loan amount"), "100.5");
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Loan amount"));
    await user.type(screen.getByLabelText("Loan amount"), "10000.00");
    await user.type(screen.getByLabelText("Loan term in months"), "12");
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(en.invalid_risk_band)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows the unrounded commission and labels the rate as a percentage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          quoteId: "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
          currency: "AUD",
          commissionRate: "1.50000",
          totalCommission: "150.000000000",
        }),
      }),
    );
    const user = userEvent.setup();
    render(<QuotePage />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(await screen.findByText(/150\.000000000/)).toBeInTheDocument();
    expect(screen.getByText(/1\.50000 percent/)).toBeInTheDocument();
    expect(screen.queryByText("150.00")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("rejects a success body that is not a quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          quoteId: "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
          currency: "AUD",
          commissionRate: "1.50000",
          totalCommission: "150.00",
        }),
      }),
    );
    const user = userEvent.setup();
    render(<QuotePage />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.vendor_unavailable,
    );
    expect(screen.queryByText(/150\.00/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows the catalog message and keeps the form usable when the quote fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ code: "vendor_unavailable", message: "raw" }),
      }),
    );
    const user = userEvent.setup();
    render(<QuotePage />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.vendor_unavailable,
    );
    expect(document.querySelector(".spinner")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loan amount")).toHaveValue("10000.00");
    expect(
      screen.getByRole("button", { name: "Generate quote" }),
    ).toBeEnabled();
    vi.unstubAllGlobals();
  });

  it("shows a temporary outage separately from a vendor failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        headers: {
          get: (name: string) => (name === "retry-after" ? "30" : null),
        },
        json: async () => ({ code: "service_unavailable", message: "raw" }),
      }),
    );
    const user = userEvent.setup();
    render(<QuotePage />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `${en.service_unavailable} Retry after 30 seconds.`,
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      en.vendor_unavailable,
    );
    vi.unstubAllGlobals();
  });

  it("does not submit twice while a quote is generating", async () => {
    let release: (value: unknown) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<QuotePage />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Generate quote" }));
    expect(
      screen.getByRole("button", { name: "Generating quote" }),
    ).toBeDisabled();
    expect(document.querySelector(".spinner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generating quote" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release({
      ok: true,
      json: async () => ({
        quoteId: "8d3c1c2e-6f0a-4d1b-9c2e-0a1b2c3d4e5f",
        currency: "AUD",
        commissionRate: "1.50000",
        totalCommission: "150.000000000",
      }),
    });
    expect(await screen.findByText(/150\.000000000/)).toBeInTheDocument();
    expect(document.querySelector(".spinner")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate quote" }),
    ).toBeEnabled();
    vi.unstubAllGlobals();
  });
});
