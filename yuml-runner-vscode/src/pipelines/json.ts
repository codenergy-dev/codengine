export function parse(args: { text: string }) {
  const json = JSON.parse(args.text)
  return json
}