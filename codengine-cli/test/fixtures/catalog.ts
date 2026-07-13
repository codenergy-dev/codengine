// TS task functions for the CLI end-to-end tests.
import type { TaskData } from "codengine-runner-ts";

export const echo = (data: TaskData): TaskData => data;
export const output = (data: TaskData): TaskData => data;
export const pick = (data: TaskData): unknown => data.i;
export const route = (data: TaskData): unknown => data.route;
export const nil = (): null => null;
export const emit = (data: TaskData): TaskData[] =>
  Array.from({ length: Number(data.n) }, (_, i) => ({ i }));
