from pathlib import Path

from agr.batch import assess_points, batch_meta, write_csv, write_jsonl
from etl.batch_assess import main


def test_assess_points_edinburgh():
    rows = assess_points([(55.9533, -3.1883), (55.8642, -4.2518)])
    assert len(rows) == 2
    assert rows[0]["annual_ground_rent_gbp"] > 0
    assert rows[0]["method"] in ("residual_drc", "productive_land_use")
    meta = batch_meta(rows, scenario="full_agr")
    assert meta["count"] == 2
    assert meta["not_statutory"] is True


def test_write_outputs(tmp_path: Path):
    rows = assess_points([(55.9533, -3.1883)])
    jsonl = tmp_path / "r.jsonl"
    csv_path = tmp_path / "r.csv"
    write_jsonl(rows, jsonl)
    write_csv(rows, csv_path)
    assert jsonl.read_text(encoding="utf-8").strip()
    assert "annual_ground_rent_gbp" in csv_path.read_text(encoding="utf-8")


def test_batch_cli_single_point(tmp_path: Path):
    out = tmp_path / "out.jsonl"
    rc = main(
        [
            "--lat",
            "55.9533",
            "--lng",
            "-3.1883",
            "--out",
            str(out),
            "--format",
            "jsonl",
        ]
    )
    assert rc == 0
    assert out.exists()
