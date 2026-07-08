def build_graph(edges):
  graph = {}
  targets = set()

  for source, target in edges:
    graph.setdefault(source, []).append(target)
    targets.add(target)

  # Roots = nodes that never appear as targets
  roots = [node for node in graph if node not in targets]
  return graph, roots

def find_paths(graph, current, current_path, all_paths):
  current_path.append(current)

  if current not in graph:  # reached a leaf node
    all_paths.append(" -> ".join(current_path))
  else:
    for neighbor in graph[current]:
      find_paths(graph, neighbor, current_path[:], all_paths)

def depth_first_search(edges):
  graph, roots = build_graph(edges)
  all_paths = []

  for root in roots:
    find_paths(graph, root, [], all_paths)

  return all_paths