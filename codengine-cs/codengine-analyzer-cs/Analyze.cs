// Analyze a C# functions file into codengine task definitions, using Roslyn
// (Microsoft.CodeAnalysis, never regex) — it reads C# the way the compiler does.
// Produces the neutral document defined by
// codengine-spec/schema/task-definition.schema.json.
//
// C# parameters are all bindable by name, so every parameter of a public static
// method becomes a named param. C# has no clean reflection-based catch-all
// convention, so `acceptsExtra` is always false (the catch-all conformance case is
// skipped, exactly like Dart).

using System.Text.Json.Nodes;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Codengine.Analyzer;

public static class Analyze
{
    public static JsonObject AnalyzeSource(string path)
    {
        string text = File.ReadAllText(path);
        var root = CSharpSyntaxTree.ParseText(text).GetCompilationUnitRoot();

        var definitions = new JsonArray();
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            if (!IsPublicStatic(method)) continue;
            string name = method.Identifier.ValueText;
            if (name == "Main") continue;
            definitions.Add(AnalyzeMethod(name, method.ParameterList));
        }

        return new JsonObject
        {
            ["version"] = "1",
            ["language"] = "cs",
            ["definitions"] = definitions,
        };
    }

    private static bool IsPublicStatic(MethodDeclarationSyntax method)
    {
        bool isPublic = method.Modifiers.Any(SyntaxKind.PublicKeyword);
        bool isStatic = method.Modifiers.Any(SyntaxKind.StaticKeyword);
        return isPublic && isStatic;
    }

    private static JsonObject AnalyzeMethod(string name, ParameterListSyntax parameters)
    {
        var paramArray = new JsonArray();
        foreach (var parameter in parameters.Parameters)
            paramArray.Add(AnalyzeParameter(parameter));

        return new JsonObject
        {
            ["name"] = name,
            ["params"] = paramArray,
            ["acceptsExtra"] = false,
        };
    }

    private static JsonObject AnalyzeParameter(ParameterSyntax parameter)
    {
        var (kind, nullable) = TypeKind(parameter.Type);
        var defaultClause = parameter.Default;
        bool required = defaultClause is null;

        var result = new JsonObject
        {
            ["name"] = parameter.Identifier.ValueText,
            ["kind"] = kind,
            ["required"] = required,
            ["nullable"] = nullable,
        };
        if (!required)
            result["default"] = Literal(defaultClause!.Value);
        return result;
    }

    private static (string Kind, bool Nullable) TypeKind(TypeSyntax? type)
    {
        if (type is null) return ("any", false);
        if (type is NullableTypeSyntax nullable)
        {
            var (kind, _) = TypeKind(nullable.ElementType);
            return (kind, true);
        }
        if (type is ArrayTypeSyntax) return ("array", false);
        string label = type switch
        {
            PredefinedTypeSyntax predefined => predefined.Keyword.ValueText,
            GenericNameSyntax generic => generic.Identifier.ValueText,
            IdentifierNameSyntax identifier => identifier.Identifier.ValueText,
            QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText,
            _ => "",
        };
        string kindName = label switch
        {
            "int" or "long" or "short" or "byte" or "sbyte" or "uint" or "ulong" or "ushort"
                or "double" or "float" or "decimal"
                or "Int32" or "Int64" or "Double" or "Single" or "Decimal" => "number",
            "string" or "String" or "char" => "string",
            "bool" or "Boolean" => "boolean",
            "List" or "IList" or "IEnumerable" or "ICollection" or "IReadOnlyList" or "HashSet"
                or "ISet" => "array",
            "Dictionary" or "IDictionary" or "IReadOnlyDictionary" => "object",
            _ => "any",
        };
        return (kindName, false);
    }

    private static JsonNode? Literal(ExpressionSyntax expression)
    {
        switch (expression)
        {
            case LiteralExpressionSyntax literal:
                return literal.Kind() switch
                {
                    SyntaxKind.NumericLiteralExpression => NumericNode(literal.Token.Value),
                    SyntaxKind.StringLiteralExpression => JsonValue.Create((string?)literal.Token.Value),
                    SyntaxKind.TrueLiteralExpression => JsonValue.Create(true),
                    SyntaxKind.FalseLiteralExpression => JsonValue.Create(false),
                    SyntaxKind.NullLiteralExpression => null,
                    _ => null,
                };
            case PrefixUnaryExpressionSyntax prefix when prefix.IsKind(SyntaxKind.UnaryMinusExpression):
                return Negate(Literal(prefix.Operand));
            default:
                return null;
        }
    }

    private static JsonNode? NumericNode(object? value) => value switch
    {
        int i => JsonValue.Create(i),
        long l => JsonValue.Create(l),
        double d => JsonValue.Create(d),
        float f => JsonValue.Create((double)f),
        decimal m => JsonValue.Create(m),
        _ => null,
    };

    private static JsonNode? Negate(JsonNode? node)
    {
        if (node is null) return null;
        var value = node.GetValue<object>();
        return value switch
        {
            int i => JsonValue.Create(-i),
            long l => JsonValue.Create(-l),
            double d => JsonValue.Create(-d),
            decimal m => JsonValue.Create(-m),
            _ => node,
        };
    }
}
