// `greet` is async; the worker awaits it (sync and async both work).
export async function greet({ name }) {
  return { message: `Hello, ${name}!` };
}

export function stepA({ x }) {
  return { x: x + 1 };
}

export function stepB({ x }) {
  return { x: x * 2 };
}
