from collections import defaultdict, deque

def topological_sort(nodes, edges):
  graph = defaultdict(list)
  indegree = {node: 0 for node in nodes}

  for src, dst in edges:
    graph[src].append(dst)
    indegree[dst] += 1

  queue = deque([n for n in nodes if indegree[n] == 0])
  ordered = []

  while queue:
    current = queue.popleft()
    ordered.append(current)
    for neighbor in graph[current]:
      indegree[neighbor] -= 1
      if indegree[neighbor] == 0:
        queue.append(neighbor)

  return ordered, graph