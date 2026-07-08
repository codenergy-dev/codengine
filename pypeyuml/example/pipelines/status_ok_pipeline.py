def status_ok_pipeline(response, **kwargs):
  if response.status == 200:
    return { "response": response }
  else:
    return None