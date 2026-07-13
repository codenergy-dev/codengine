# The same greeting tasks in Python, for `--language py`.
# `greet` receives `name` as a named argument — no generic dict.
def greet(name):
    return {"message": f"Hello, {name}!"}


def output(**data):
    return data
