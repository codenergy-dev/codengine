export function merge({ a, ...rest }: { a: number } & Record<string, unknown>) {
  return { a, ...rest };
}
