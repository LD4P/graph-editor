try:
    from pyscript import sync
except ImportError:
    sync = None


def ping():
    return "pong"


if sync is not None:
    sync.ping = ping
