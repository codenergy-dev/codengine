# Served by a remote Python worker (an already-running HTTP service). The orchestrator
# never sees these files — it calls the service by module name over HTTP.
def greet(name):
    return {"message": f"Hello, {name}!"}


def output(message):
    return {"message": message}
