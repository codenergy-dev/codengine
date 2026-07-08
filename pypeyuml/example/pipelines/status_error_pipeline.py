def status_error_pipeline(response, **kwargs):
  if response.status >= 400:
    return { "response": response }
  else:
    return None