import { suffix } from "./helper.ts";
export const greet = ({ name }: { name: string }) => ({ message: `Hello, ${name}${suffix}` });
export const output = (data: Record<string, unknown>) => data;
