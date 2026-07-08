import 'dart:convert';
import 'dart:io';

import 'package:analyzer/dart/analysis/features.dart';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';

void main(List<String> args) {
  if (args.length < 2) {
    stderr.writeln(
      'Uso: dart run extract_functions.dart <input.dart> <output.json>',
    );
    exit(1);
  }

  final inputFile = args[0];
  final outputFile = args[1];

  final source = File(inputFile);
  if (!source.existsSync()) {
    stderr.writeln('Arquivo não encontrado: $inputFile');
    exit(1);
  }

  final parseResult = parseFile(
    path: inputFile,
    featureSet: FeatureSet.latestLanguageVersion(), // usa o default do SDK
  );

  final unit = parseResult.unit;

  final Map<String, List<Map<String, String>>> functions = {};

  for (final declaration in unit.declarations) {
    if (declaration is FunctionDeclaration) {
      final name = declaration.name.lexeme;

      // Apenas funções top-level
      final functionExpr = declaration.functionExpression;
      final parameters = functionExpr.parameters;

      final argsList = <Map<String, String>>[];

      if (parameters != null) {
        for (final param in parameters.parameters) {
          if (param is SimpleFormalParameter) {
            final paramName = param.name?.lexeme ?? 'unknown';
            final paramType =
                param.type?.toSource() ?? 'dynamic';

            argsList.add({
              'name': paramName,
              'type': paramType,
            });
          } else if (param is DefaultFormalParameter &&
              param.parameter is SimpleFormalParameter) {
            final inner =
                param.parameter as SimpleFormalParameter;

            final paramName = inner.name?.lexeme ?? 'unknown';
            final paramType =
                inner.type?.toSource() ?? 'dynamic';

            argsList.add({
              'name': paramName,
              'type': paramType,
            });
          }
        }
      }

      functions[name] = argsList;
    }
  }

  final jsonOutput = const JsonEncoder.withIndent('  ').convert(functions);
  File(outputFile).writeAsStringSync(jsonOutput);

  stdout.writeln('✔ JSON gerado em $outputFile');
}
