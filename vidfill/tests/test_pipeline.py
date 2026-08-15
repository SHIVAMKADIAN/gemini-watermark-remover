from vidfill.pipeline import selftest


def test_selftest_passes():
    report = selftest()
    assert report["coverage"] > 0.8
    assert report["retrieval_mae"] < 12
