import { Workflows } from "yuml-runner";
import ast from "@/workflows/ast"
import extension from "@/workflows/extension"
import workspace from "@/workflows/workspace"
import yumlParser from "@/workflows/yuml-parser"
import yuml from "@/workflows/yuml"

export const workflows = Workflows.fromJson([
  ...ast,
  ...extension,
  ...workspace,
  ...yumlParser,
  ...yuml,
])

workflows.bindModules({
  'ast': () => import('@/pipelines/ast') as any,
  'child-process': () => import('@/pipelines/child-process') as any,
  'extension': () => import('@/pipelines/extension') as any,
  'fetch': () => import('@/pipelines/fetch') as any,
  'format': () => import('@/pipelines/format') as any,
  'fs': () => import('@/pipelines/fs') as any,
  'json': () => import('@/pipelines/json') as any,
  'path': () => import('@/pipelines/path') as any,
  'workspace': () => import('@/pipelines/workspace') as any,
  'yuml-parser': () => import('@/pipelines/yuml-parser') as any,
  'yuml': () => import('@/pipelines/yuml') as any,
})