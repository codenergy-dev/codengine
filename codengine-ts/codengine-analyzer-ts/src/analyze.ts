// Analyze a TypeScript functions module into codengine task definitions, using the
// TypeScript Compiler API (never regex) — the type checker reads the code the way
// TypeScript does.

import ts from "typescript";
import type { Kind, Param, TaskDefinition, TaskDefinitions } from "./types.js";

export function analyzeSource(filePath: string): TaskDefinitions {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, // strictNullChecks keeps `| null` so we can detect nullable
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) throw new Error(`Cannot read source '${filePath}'.`);

  const definitions: TaskDefinition[] = [];
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      definitions.push(analyzeFunction(checker, statement.name.text, statement.parameters));
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
          ts.isIdentifier(declaration.name)
        ) {
          definitions.push(analyzeFunction(checker, declaration.name.text, initializer.parameters));
        }
      }
    }
  }

  return { version: "1", language: "ts", definitions };
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function analyzeFunction(
  checker: ts.TypeChecker,
  name: string,
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
): TaskDefinition {
  const parameter = parameters[0];
  if (!parameter) return { name, params: [], acceptsExtra: false };

  const type = checker.getTypeAtLocation(parameter);
  // An untyped / any / unknown parameter is an open bag: no named params.
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
    return { name, params: [], acceptsExtra: true };
  }

  const { defaults, hasRest } = readBinding(parameter);
  const properties = checker
    .getPropertiesOfType(type)
    .slice()
    .sort((a, b) => declarationPosition(a) - declarationPosition(b));

  const params: Param[] = properties.map((property) => {
    const propertyName = property.getName();
    const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, parameter);
    const param: Param = {
      name: propertyName,
      kind: kindOf(checker, checker.getNonNullableType(propertyType)),
      required: !optional && !defaults.has(propertyName),
      nullable: isNullable(propertyType),
    };
    const literal = defaults.has(propertyName) ? literalValue(defaults.get(propertyName)!) : undefined;
    if (literal !== undefined) param.default = literal.value;
    return param;
  });

  const acceptsExtra = hasRest || type.getStringIndexType() !== undefined;
  return { name, params, acceptsExtra };
}

function readBinding(parameter: ts.ParameterDeclaration): {
  defaults: Map<string, ts.Expression>;
  hasRest: boolean;
} {
  const defaults = new Map<string, ts.Expression>();
  let hasRest = false;
  if (parameter.name && ts.isObjectBindingPattern(parameter.name)) {
    for (const element of parameter.name.elements) {
      if (element.dotDotDotToken) {
        hasRest = true;
        continue;
      }
      const propertyName = element.propertyName
        ? bindingPropertyName(element.propertyName)
        : ts.isIdentifier(element.name)
          ? element.name.text
          : undefined;
      if (propertyName && element.initializer) defaults.set(propertyName, element.initializer);
    }
  }
  return { defaults, hasRest };
}

function bindingPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function declarationPosition(symbol: ts.Symbol): number {
  return symbol.declarations?.[0]?.pos ?? 0;
}

function isNullable(type: ts.Type): boolean {
  const parts = type.isUnion() ? type.types : [type];
  return parts.some((part) => (part.flags & ts.TypeFlags.Null) !== 0);
}

function kindOf(checker: ts.TypeChecker, type: ts.Type): Kind {
  const flags = type.flags;
  if (flags & ts.TypeFlags.NumberLike) return "number";
  if (flags & ts.TypeFlags.StringLike) return "string";
  if (flags & ts.TypeFlags.BooleanLike) return "boolean";
  if (type.getSymbol()?.getName() === "Array") return "array";
  if (flags & ts.TypeFlags.Object) return "object";
  return "any";
}

function literalValue(node: ts.Expression): { value: unknown } | undefined {
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { value: node.text };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { value: null };
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { value: -Number(node.operand.text) };
  }
  return undefined;
}
