// Task functions for the greeting workflow (plain ESM — no build step).
export const greet = (data) => ({ message: `Hello, ${data.name}!` });
export const output = (data) => data;
