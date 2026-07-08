class Pipeline:
  def __init__(self, name: str, function: str, path: str, workflow: str, args: dict = None):
    self.name = name
    self.function = function
    self.path = path
    self.workflow = workflow
    self.args: dict = args if args else {}
    self.fanIn: list[str] = []
    self.fanInNullable: list[str] = []
    self.fanOut: list[str] = []
    self.entrypoint: bool = True
    self.dependencies: list[str] = []
    self.executionPlan: list[str] = []