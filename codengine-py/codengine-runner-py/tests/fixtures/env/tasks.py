from helper import VALUE  # sibling import — only resolves when root is on sys.path


def greet(name):
    return {"message": f"{name}:{VALUE}"}
