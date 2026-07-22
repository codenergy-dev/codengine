// Analyze a C# functions file into codengine task definitions, using Roslyn
// (Microsoft.CodeAnalysis, never regex) — it reads C# the way the compiler does. The
// definition *types* live in codengine-core-cs (the description contract), so a
// generator could consume exactly what this produces.
//
// C# parameters are all bindable by name, so every parameter of a public static
// method becomes a named param. C# has no clean reflection-based catch-all
// convention, so `acceptsExtra` is always false (the catch-all conformance case is
// skipped, exactly like Dart).

using Codengine.Core;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Codengine.Analyzer;

public static class Analyze
{
    public static TaskDefinitionDocument AnalyzeSource(string path)
    {
        string text = File.ReadAllText(path);
        var root = CSharpSyntaxTree.ParseText(text).GetCompilationUnitRoot();

        var definitions = new List<TaskDefinition>();
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            if (!IsPublicStatic(method)) continue;
            string name = method.Identifier.ValueText;
            if (name == "Main") continue;
            definitions.Add(AnalyzeMethod(name, method.ParameterList));
        }

        return new TaskDefinitionDocument { Language = "cs", Definitions = definitions };
    }

    private static bool IsPublicStatic(MethodDeclarationSyntax method) =>
        method.Modifiers.Any(SyntaxKind.PublicKeyword) && method.Modifiers.Any(SyntaxKind.StaticKeyword);

    private static TaskDefinition AnalyzeMethod(string name, ParameterListSyntax parameters) =>
        new()
        {
            Name = name,
            Params = parameters.Parameters.Select(AnalyzeParameter).ToList(),
            AcceptsExtra = false,
        };

    private static ParamDefinition AnalyzeParameter(ParameterSyntax parameter)
    {
        var (kind, nullable) = TypeKind(parameter.Type);
        var defaultClause = parameter.Default;
        return new ParamDefinition
        {
            Name = parameter.Identifier.ValueText,
            Kind = kind,
            Required = defaultClause is null,
            Nullable = nullable,
            Default = defaultClause is null ? null : Literal(defaultClause.Value),
        };
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

    // A literal default as a plain CLR value (integers -> long, reals -> double), the
    // same normalization the execution side uses.
    private static object? Literal(ExpressionSyntax expression)
    {
        switch (expression)
        {
            case LiteralExpressionSyntax literal:
                return literal.Kind() switch
                {
                    SyntaxKind.NumericLiteralExpression => NormalizeNumber(literal.Token.Value),
                    SyntaxKind.StringLiteralExpression => (string?)literal.Token.Value,
                    SyntaxKind.TrueLiteralExpression => true,
                    SyntaxKind.FalseLiteralExpression => false,
                    SyntaxKind.NullLiteralExpression => null,
                    _ => null,
                };
            case PrefixUnaryExpressionSyntax prefix when prefix.IsKind(SyntaxKind.UnaryMinusExpression):
                return Negate(Literal(prefix.Operand));
            default:
                return null;
        }
    }

    private static object? NormalizeNumber(object? value) => value switch
    {
        double d => d,
        float f => (double)f,
        decimal m => (double)m,
        null => null,
        _ => Convert.ToInt64(value), // int/long/short/byte/uint/... -> long
    };

    private static object? Negate(object? value) => value switch
    {
        long l => -l,
        double d => -d,
        _ => value,
    };
}
