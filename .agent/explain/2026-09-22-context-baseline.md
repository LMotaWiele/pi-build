# Context baseline — 2026-09-22

Stage 1 of the context spec. The context usage panel (`npm:pi-context-usage` 1.0.2) is installed and kept. It draws a picture of the current context and changes no behaviour. Later stages were not started.

The database for this run is listed in `docs/README.md`. This file does not repeat the path.

Catalog dollars are the model card 5 / 0.50 / 30. The stored cost column sums provider `usage.cost`, and on this run that sum matches the promo card 4 / 0.40 / 20 on the same tokens.

## What ran

One headless turn on a throwaway copy, on 2026-09-23. Model `gpt-5.6-sol`, tier `escalate`, thinking high. The prompt asked for §6.1, §6.2, and §6.3 of the context spec. The turn stopped on `max loop depth 60` at 1,235.187s. The wall bound did not fire.

The session file has 0 compaction entries. Peak context was 200,730 of the 272,000 window (73.8%). Compaction fires when context tokens pass 255,616, the window minus the 16,384 reserve. This peak sits 54,886 tokens under that line, so nothing was summarized and there is no re-establishment cost.

The turn reported its own test run as 49 passed, 0 failed, 1 skipped. Those edits stay on the copy.

## Parent

Sixty calls, all `gpt-5.6-sol` / `escalate`, one turn.

| | |
|---|---|
| Prompt tokens | 9,271,183 |
| Cached tokens | 9,070,336 |
| Cache read share | 0.9783 |
| Completion tokens | 32,316 |
| Generated reasoning tokens | 13,496 |
| Peak context | 200,730 |
| Compactions | 0 |
| Catalog cost | $6.508883 |
| Stored provider cost | $5.077842 |

Prompt tokens here are the sum of every call's input. They are not the size of one context. The peak call is uncached 666 plus cache read 200,064.

On this run each call's stored cost matches charging `prompt_tokens` and `cached_tokens` as separate fields, including two early calls whose cache read is smaller than the uncached input. The overlap rule would have reported 9,224,719 prompt tokens and a cache read share of 0.9833 by dropping those two cache reads. The cost match is why the table adds both fields. The peak call's cache read is the larger field, so 200,730 is the same either way.

The cache read share sits above the historical 0.73–0.88 band. A continuation bills a small uncached delta and a large cache read, and that is most of these 60 calls.

Generated reasoning is 13,496 of the 32,316 completion tokens. That is how much the model produced. It is a different number from the reasoning sitting in the context.

## Peak breakdown

The usage panel was not opened. Running it would have been another billed turn. Its buckets are System Prompt, Tools, Messages, Empty, and Buffer. Buffer is the model's max output, 128,000 tokens, and Empty is 0 because 200,730 + 128,000 already fills the window. The panel has no reasoning category. Messages is whatever remains after the system prompt and the tool definitions.

The first call's context was 8,324 tokens: cache read 7,936 and uncached 388. Instructions were 14,967 characters on every full parent request, 3,742 tokens at 4 characters per token. The rest of that cache read, 4,194 tokens, is the tool-definition estimate. The 388 uncached tokens are the user message. Growth after that call is 192,406 tokens.

| Bucket | Tokens | Share of the 200,730 peak |
|---|---|---|
| System prompt | 3,742 | 1.9% |
| Tool definitions | 4,194 | 2.1% |
| User message | 388 | 0.2% |
| Tool results | 135,708 | 67.6% |
| Reasoning | 39,499 | 19.7% |
| Tool calls | 17,199 | 8.6% |

The panel would show the system and tool-definition lines as above, fold the user message into Messages, and report Messages as 192,794 tokens. Tool results, reasoning, and tool calls are the spec's split of the 192,406 tokens that grew after the first call. They are character shares from the largest assembled request, applied to those provider tokens:

| Piece of that request | Characters | Count |
|---|---|---|
| Tool results | 636,225 | 110 |
| Reasoning | 185,181 | 68 |
| of which encrypted | 168,356 | 68 |
| of which summary | 8,121 | 68 |
| Tool calls | 80,629 | 110 |
| User | 1,088 | 1 |

Four characters per token on that whole body is about 225,781, above the provider total of 200,730. The encrypted reasoning is the bulky part. The token column in the first table is the allocation onto provider tokens.

## Assembled request

The assembled request is the full body logged before a continuation id is attached. The parent logged 61 of those and 59 continuations. The fullest full body had 289 items and 68 reasoning blocks, every one encrypted, every one after the single user message. Prior-turn reasoning blocks: 0. The continuations contained no reasoning items.

One user message means a previous turn's reasoning was never on the table. Within the turn, the encrypted reasoning blocks are in the full body.

## Reading

Tool results are 67.6% of the peak. That is the pre-committed row for tool results over 50%. Reasoning at 19.7% leaves the two rows that start from reasoning over 50% unfired. The row where no category exceeds 40% is unfired as well.

The spec's next measurement from this reading was stage 4, with stage 3 secondary. Stage 3 had no earlier turn to inspect. Neither stage was started.

## Children

Two explore children of the same parent turn. They are outside the parent totals and outside the peak. Both stopped on `no progress: 6 reads and 0 edits`. Neither edited.

| | Calls | Prompt tokens | Cache share | Peak | Completion | Reasoning | Catalog | Wall |
|---|---|---|---|---|---|---|---|---|
| First | 4 | 56,188 | 0.4738 | 29,269 | 849 | 200 | $0.186602 | 33.227s |
| Second | 4 | 107,277 | 0.4272 | 61,085 | 817 | 107 | $0.354687 | 31.271s |

Stored provider costs were $0.145886 and $0.280482.

## Other rows

The copy's unit tests wrote fixture inference rows into the same database. Those rows use session id `s` or model `provider/model` or model `work`. The tables above leave them out.

Parent tool errors were 7 bash errors, at most 2 in a row. The consecutive-failure bound did not fire.

Index injection logged a truncation at 650 tokens. That is the injection this turn actually sent. The §6.3 cap was not applied on this tree.
