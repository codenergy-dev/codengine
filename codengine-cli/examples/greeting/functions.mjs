// Task functions for the greeting workflow (plain ESM — no build step).
// `greet` destructures the named input it needs.
export const greet = ({ name }) => ({ message: `Hello, ${name}!` });
export const output = (data) => data;
