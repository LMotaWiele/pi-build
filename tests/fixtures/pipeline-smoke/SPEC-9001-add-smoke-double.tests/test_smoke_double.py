from map_build.smoke_double import double


def test_double():
    assert double(3) == 6
    assert double(0) == 0
    assert double(-4) == -8
