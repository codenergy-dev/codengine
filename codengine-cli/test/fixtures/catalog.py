# Python task functions for the CLI end-to-end tests.


def echo(data):
    return data


def output(data):
    return data


def pick(data):
    return data["i"]


def route(data):
    return data["route"]


def nil(data):
    return None


def emit(data):
    return [{"i": i} for i in range(data["n"])]
