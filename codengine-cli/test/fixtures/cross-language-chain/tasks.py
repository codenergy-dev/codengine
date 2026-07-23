# A straight-line Python segment (step_a -> step_b -> output): the engine hands it to
# the Python worker as one chain (one boundary crossing).
def step_a(message):
    return {"message": message + " a"}


def step_b(message):
    return {"message": message + " b"}


def output(message):
    return {"message": message}
