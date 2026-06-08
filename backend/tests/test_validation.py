from validation.glasgow_ward_18 import run_validation


def test_glasgow_ward_18_validation_passes():
    report = run_validation(sample_count=6)
    assert report["status"] == "pass"
    assert report["all_in_ward"] is True
    assert report["all_in_glasgow"] is True
    assert report["samples_tested"] >= 1