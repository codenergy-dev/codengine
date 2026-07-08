from urllib.request import urlopen

def urlopen_pipeline(url: str, **kwargs):
  return { "response": urlopen(url) }