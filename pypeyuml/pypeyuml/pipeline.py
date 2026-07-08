from enum import Enum

class PipelineState(str, Enum):
  IDLE = "idle"
  EXEC = "exec"
  WAIT = "wait"
  DONE = "done"

class Pipeline:
  def __init__(self, name: str, function: str, args: dict = None):
    self.name = name
    self.function = function
    self.args: dict = args if args else {}
    self.fanIn: list[str] = []
    self.fanInCheck: list[str] = []
    self.fanOut: list[str] = []
    self.fanOutPending: str = None
    self.state: PipelineState = PipelineState.IDLE
    self.input: dict = {}
    self.output = None