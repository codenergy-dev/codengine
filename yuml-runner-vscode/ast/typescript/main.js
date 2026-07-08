#!/usr/bin/env node
import ts from "typescript";
import fs from "fs";
import path from "path";
function die(message) {
    console.error("\u274C ".concat(message));
    process.exit(1);
}
var _a = process.argv, inputFile = _a[2], outputFile = _a[3];
if (!inputFile || !outputFile) {
    die("Uso: node extract-functions.js <input.ts> <output.json>");
}
if (!fs.existsSync(inputFile)) {
    die("Arquivo n\u00E3o encontrado: ".concat(inputFile));
}
var projectPath = path.dirname(inputFile);
// tenta achar tsconfig.json (opcional, mas melhora type resolution)
var configPath = ts.findConfigFile(projectPath, ts.sys.fileExists, "tsconfig.json");
var compilerOptions = {};
if (configPath) {
    var configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    var parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
    compilerOptions = parsed.options;
}
var program = ts.createProgram({
    rootNames: [inputFile],
    options: compilerOptions,
});
var checker = program.getTypeChecker();
var source = program.getSourceFile(inputFile);
if (!source) {
    die("Não foi possível carregar o arquivo de origem");
}
var output = {};
ts.forEachChild(source, function (node) {
    var _a;
    if (ts.isFunctionDeclaration(node) &&
        node.name &&
        ((_a = node.modifiers) === null || _a === void 0 ? void 0 : _a.some(function (m) { return m.kind === ts.SyntaxKind.ExportKeyword; }))) {
        var symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol)
            return;
        var functionName = symbol.getName();
        output[functionName] = [];
        var firstParam = node.parameters[0];
        if (!firstParam)
            return;
        var paramType = checker.getTypeAtLocation(firstParam);
        // se for um type reference explícito
        if (firstParam.type &&
            ts.isTypeReferenceNode(firstParam.type)) {
            var typeSymbol = checker.getSymbolAtLocation(firstParam.type.typeName);
            if (typeSymbol) {
                paramType = checker.getDeclaredTypeOfSymbol(typeSymbol);
            }
        }
        var properties = paramType.getProperties();
        for (var _i = 0, properties_1 = properties; _i < properties_1.length; _i++) {
            var prop = properties_1[_i];
            var decl = prop.valueDeclaration;
            if (!decl)
                continue;
            var propType = checker.getTypeOfSymbolAtLocation(prop, decl);
            output[functionName].push({
                name: prop.getName(),
                type: checker.typeToString(propType),
            });
        }
    }
});
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf-8");
console.log("\u2714 JSON gerado em ".concat(outputFile));
