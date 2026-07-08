def rename_args_pipeline(**kwargs):
  output = {}
  for key, value in kwargs.items():
    if key.startswith("_"):
      output[value] = kwargs[key.removeprefix("_")]
  return output