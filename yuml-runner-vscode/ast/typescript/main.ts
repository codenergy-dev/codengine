#!/usr/bin/env node

import ts from "typescript"
import fs from "fs"
import path from "path"

function die(message: string): never {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const [, , inputFile, outputFile] = process.argv

if (!inputFile || !outputFile) {
  die("Uso: node extract-functions.js <input.ts> <output.json>")
}

if (!fs.existsSync(inputFile)) {
  die(`Arquivo não encontrado: ${inputFile}`)
}

const projectPath = path.dirname(inputFile)

// tenta achar tsconfig.json (opcional, mas melhora type resolution)
const configPath = ts.findConfigFile(
  projectPath,
  ts.sys.fileExists,
  "tsconfig.json"
)

let compilerOptions: ts.CompilerOptions = {}

if (configPath) {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  )
  compilerOptions = parsed.options
}

const program = ts.createProgram({
  rootNames: [inputFile],
  options: compilerOptions,
})

const checker = program.getTypeChecker()
const source = program.getSourceFile(inputFile)

if (!source) {
  die("Não foi possível carregar o arquivo de origem")
}

type Output = {
  [functionName: string]: {
    name: string
    type: string
  }[]
}

const output: Output = {}

ts.forEachChild(source, node => {
  if (
    ts.isFunctionDeclaration(node) &&
    node.name &&
    node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
  ) {
    const symbol = checker.getSymbolAtLocation(node.name)
    if (!symbol) return

    const functionName = symbol.getName()
    output[functionName] = []

    const firstParam = node.parameters[0]
    if (!firstParam) return

    let paramType = checker.getTypeAtLocation(firstParam)

    // se for um type reference explícito
    if (
      firstParam.type &&
      ts.isTypeReferenceNode(firstParam.type)
    ) {
      const typeSymbol = checker.getSymbolAtLocation(
        firstParam.type.typeName
      )
      if (typeSymbol) {
        paramType = checker.getDeclaredTypeOfSymbol(typeSymbol)
      }
    }

    const properties = paramType.getProperties()

    for (const prop of properties) {
      const decl = prop.valueDeclaration
      if (!decl) continue

      const propType = checker.getTypeOfSymbolAtLocation(prop, decl)

      output[functionName].push({
        name: prop.getName(),
        type: checker.typeToString(propType),
      })
    }
  }
})

fs.writeFileSync(
  outputFile,
  JSON.stringify(output, null, 2),
  "utf-8"
)

console.log(`✔ JSON gerado em ${outputFile}`)
