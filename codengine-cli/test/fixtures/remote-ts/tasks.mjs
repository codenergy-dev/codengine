export function greet({ name }) {
  return { message: `Hello, ${name}!` };
}
export function output({ message }) {
  return { message };
}
