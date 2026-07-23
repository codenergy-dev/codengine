// TS/JS module "en": runs in-process in the orchestrating engine.
export function greet({ name }) {
  return { message: `Hello, ${name}!` };
}
