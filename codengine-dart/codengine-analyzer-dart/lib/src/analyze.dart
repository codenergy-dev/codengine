// Analyze a Dart functions file into codengine task definitions, using the
// `analyzer` package (never regex) — it reads Dart the way Dart does. Produces the
// neutral document defined by codengine-spec/schema/task-definition.schema.json.

import 'package:analyzer/dart/analysis/features.dart';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';

Map<String, dynamic> analyzeSource(String path) {
  final result = parseFile(
    path: path,
    featureSet: FeatureSet.latestLanguageVersion(),
    throwIfDiagnostics: false,
  );

  final definitions = <Map<String, dynamic>>[];
  for (final declaration in result.unit.declarations) {
    if (declaration is! FunctionDeclaration) continue;
    if (declaration.isGetter || declaration.isSetter) continue;
    final name = declaration.name.lexeme;
    if (name.startsWith('_')) continue;
    definitions.add(_analyzeFunction(name, declaration.functionExpression.parameters));
  }

  return {'version': '1', 'language': 'dart', 'definitions': definitions};
}

Map<String, dynamic> _analyzeFunction(String name, FormalParameterList? parameters) {
  final params = <Map<String, dynamic>>[];
  var acceptsExtra = false;
  for (final parameter in parameters?.parameters ?? const <FormalParameter>[]) {
    if (parameter.isNamed) {
      params.add(_analyzeParameter(parameter)); // codengine binds by name
    } else {
      // A positional param receiving the whole input map (`Map`/`dynamic`) is the
      // Dart equivalent of a catch-all — it receives every key.
      final (kind, _) = _typeKind(_positionalType(parameter));
      if (kind == 'object' || kind == 'any') acceptsExtra = true;
    }
  }
  return {'name': name, 'params': params, 'acceptsExtra': acceptsExtra};
}

TypeAnnotation? _positionalType(FormalParameter parameter) {
  if (parameter is SimpleFormalParameter) return parameter.type;
  if (parameter is DefaultFormalParameter) {
    final inner = parameter.parameter;
    if (inner is SimpleFormalParameter) return inner.type;
  }
  return null;
}

Map<String, dynamic> _analyzeParameter(FormalParameter parameter) {
  TypeAnnotation? type;
  Expression? defaultValue;
  if (parameter is DefaultFormalParameter) {
    defaultValue = parameter.defaultValue;
    final inner = parameter.parameter;
    if (inner is SimpleFormalParameter) type = inner.type;
  } else if (parameter is SimpleFormalParameter) {
    type = parameter.type;
  }

  final (kind, nullable) = _typeKind(type);
  final required = parameter.isRequiredNamed;

  final result = <String, dynamic>{
    'name': parameter.name!.lexeme,
    'kind': kind,
    'required': required,
    'nullable': nullable,
  };
  if (!required) {
    // An optional named parameter with no explicit default defaults to null.
    if (defaultValue == null) {
      result['default'] = null;
    } else {
      final (ok, value) = _literal(defaultValue);
      if (ok) result['default'] = value;
    }
  }
  return result;
}

(String, bool) _typeKind(TypeAnnotation? type) {
  if (type is! NamedType) return ('any', false);
  final nullable = type.question != null;
  final kind = switch (type.name2.lexeme) {
    'int' || 'double' || 'num' => 'number',
    'String' => 'string',
    'bool' => 'boolean',
    'List' || 'Iterable' || 'Set' => 'array',
    'Map' => 'object',
    _ => 'any',
  };
  return (kind, nullable);
}

(bool, dynamic) _literal(Expression expression) {
  if (expression is IntegerLiteral) return (true, expression.value);
  if (expression is DoubleLiteral) return (true, expression.value);
  if (expression is BooleanLiteral) return (true, expression.value);
  if (expression is SimpleStringLiteral) return (true, expression.value);
  if (expression is NullLiteral) return (true, null);
  if (expression is PrefixExpression && expression.operator.lexeme == '-') {
    final operand = expression.operand;
    if (operand is IntegerLiteral) return (true, -(operand.value ?? 0));
    if (operand is DoubleLiteral) return (true, -operand.value);
  }
  return (false, null);
}
