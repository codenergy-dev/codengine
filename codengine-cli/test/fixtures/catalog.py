# Python task functions for the CLI end-to-end tests.
# Natural signatures per the invocation contract (named binding).


def echo(**data):
    return data


def output(**data):
    return data


def pick(i):
    return i


def route(route):
    return route


def nil(**data):
    return None


def emit(n):
    return [{"i": i} for i in range(n)]
