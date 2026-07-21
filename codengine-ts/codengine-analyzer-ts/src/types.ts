// Task-definition types. Mirror of codengine-spec/schema/task-definition.schema.json.

export type Kind = "number" | "boolean" | "string" | "array" | "object" | "any";

export interface Param {
  name: string;
  kind: Kind;
  required: boolean;
  nullable: boolean;
  default?: unknown;
}

export interface TaskDefinition {
  name: string;
  params: Param[];
  acceptsExtra: boolean;
}

export interface TaskDefinitions {
  version: "1";
  language: string;
  definitions: TaskDefinition[];
}
