export function resize({
  width,
  height = 100,
  ratio = null,
}: {
  width: number;
  height?: number;
  ratio?: number | null;
}) {
  return { width, height, ratio };
}
