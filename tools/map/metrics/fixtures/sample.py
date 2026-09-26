def simple(a):
    return a


def branchy(a, b, c):
    if a and b:
        return 1
    for item in c:
        if item > 2:
            return item
    return 0


class Box:
    def open(self):
        return True

    def close(self, force=False):
        return force or self.open()
