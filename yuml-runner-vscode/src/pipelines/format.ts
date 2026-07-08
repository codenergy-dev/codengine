export function formatString(args: { source: string, [format: string]: string }) {
  var value = args.source
  for (var [key, value] of Object.entries(args)) {
    value.replaceAll(`\$\{${key}\}`, value)
  }
  return { value }
}

export function formatArgs(args: Record<string, any>) {
  var result: Record<string, any> = {}
  var exclude: string[] = []
  for (var [key, value] of Object.entries(args)) {
    if (key.startsWith('$')) {
      var from = key.substring(1)
      var to = value
      result[to] = args[from]
      exclude.push(from)
    }
  }
  for (var [key, value] of Object.entries(args)) {
    if (!key.startsWith('$') && !exclude.includes(key)) {
      result[key] = value
    }
  }
  return result
}