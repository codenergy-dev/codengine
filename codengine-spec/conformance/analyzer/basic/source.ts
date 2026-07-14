export function greet({ name }: { name: string }) {
  return { message: name };
}

export function add({ a, b }: { a: number; b: number }) {
  return { sum: a + b };
}
