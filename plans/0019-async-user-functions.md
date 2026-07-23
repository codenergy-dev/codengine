# 0019 — Async user functions

Status: done

## Goal

A user's task function may be **synchronous or asynchronous** — codengine accepts
both, in every language, with no adaptation. The rule is uniform: **after invoking,
if the result is awaitable (Promise / Task / Future / coroutine), resolve it before
classifying.** Classification always runs on the resolved value.

## Where the resolution lives (per language)

The call happens in two places — the single-language **runner engine** and the
**worker** — so the fix goes in the shared invocation point where possible.

- **TS** — already works. The engine `await`s `executor.execute(...)`; `await` on a
  non-Promise is transparent. The worker `await`s `fn(data)`. (Add tests to lock it.)
- **Python** — `loader-py`'s `invoke` resolves the result: if `inspect.isawaitable`,
  run it to completion (`asyncio.run`). One home, used by both the engine and the
  worker. The engine stays synchronous (it blocks on the coroutine).
- **C#** — `loader-cs`'s `Bind` wrapper resolves the result: if it's a `Task` /
  `Task<T>`, `GetAwaiter().GetResult()` (blocking) and take `.Result`. One home, used
  by both the engine and the worker. The engine stays synchronous.
- **Dart** — Dart **cannot** block on a `Future` synchronously, so the resolution
  must be `await`. That forces the **runner engine to be async**: `runtime.dart`'s
  `run` / `_executeWorkflow` become `Future`, awaiting each function call. The worker
  (`serve`) becomes async too. This also matches the "engines async from the start"
  preference.

## Steps

1. [x] Python — `invoke` resolves awaitables (`asyncio.run`); unit test with an
   `async def`. Covers the runner engine + the worker (both use `invoke`).
2. [x] C# — `Bind` resolves `Task`/`Task<T>` (`GetAwaiter().GetResult()`); the
   cross-language-cs fixture's `output` is `async`, exercised through the worker.
3. [x] Dart — `runtime.dart` is async (`run`/`_executeWorkflow` await each call);
   the run-glue `await run`s; the conformance `main` awaits; `worker-dart` is async.
   Async fixtures: single-language `dart-project` (runner path) + cross-language-dart
   (worker path).
4. [x] TS — async fixtures: cross-language `greet` (in-process) + the worker-ts test.
   The engine already awaited, so this only locks the behaviour.
5. [x] Docs: plan done + a one-line note in AGENTS.

## Outcome / notes

- **All four languages accept sync and async task functions**, single-language and
  cross-language. Verified: CLI 16/16 (0 skipped) with async fixtures for TS/C#/Dart,
  loader-py 8 (async `invoke`), Dart conformance 16 through the now-async engine.
- Python and C# engines stayed synchronous (they block on the awaitable inside
  `invoke` / `Bind`); the Dart engine became async because the language cannot block on
  a `Future`; TS was already async.
- Limits: C# resolves `Task`/`Task<T>` (not `ValueTask`); Python `asyncio.run` per
  call (a persistent event loop in the warm worker is a future optimization).

## Notes

- Python `asyncio.run` per call is correct and simple; a persistent event loop is a
  future optimization (a warm worker could keep one loop). Dart/C#/TS have no such
  cost.
- The engine's sync/async is independent from the user's function style: Python and C#
  engines stay sync (block on the awaitable); the Dart engine goes async because the
  language leaves no choice; TS is already async.
- `classify` is unchanged everywhere — it only ever sees a resolved value.
