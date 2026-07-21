from helper import VALUE  # resolves only because root is on sys.path


def greet(name):
    return {"message": f"{name}:{VALUE}"}


def output(**data):
    return data
