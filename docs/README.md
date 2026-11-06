# Docs

Internal design for the commission quote app. The root `README.md` is the only guide a reviewer needs to run the app. It is written in the documentation phase and points here.

| Path | What it is |
| --- | --- |
| `requirements.md` | The take-home brief |
| `architecture/ARCHITECTURE.md` | System design, money, HTTP, ports, risks |
| `architecture/overview.mmd` | Web server, internal API, external API, and the contract package |
| `architecture/sequence-success.mmd` | A quote from the form, through the internal API, to the external API |
| `architecture/sequence-failure.mmd` | Rejected input, external failure, timeout, 429, and 503 |
| `DESIGN.md` | Visual spec for the quote screen |
| `PHASES.md` | Phases, gates, and reviews |
| `prompts.md` | The working prompts that produced this design |

Application code stays in `apps/` and `packages/`. Do not add markdown design notes at the repo root.
