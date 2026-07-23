// TS/JS module "en": runs in-process in the orchestrating engine. `async` — codengine
// accepts sync and async task functions alike (the engine awaits the result).
export async function greet({ name }) {
  return { message: `Hello, ${name}!` };
}
