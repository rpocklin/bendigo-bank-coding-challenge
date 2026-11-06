import {
  Agent,
  type RequestInit as UndiciInit,
  fetch as undiciFetch,
} from "undici";

export function trustedVendorFetch(ca: Buffer): typeof fetch {
  const agent = new Agent({ connect: { ca: ca.toString("utf8") } });
  return (input, init) =>
    undiciFetch(input as string, {
      method: init?.method,
      headers: init?.headers as UndiciInit["headers"],
      body: init?.body as UndiciInit["body"],
      signal: init?.signal,
      dispatcher: agent,
    }) as unknown as Promise<Response>;
}
