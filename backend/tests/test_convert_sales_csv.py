import csv
from pathlib import Path

from datasources.sales_store import SalesStore
from etl.convert_sales_csv import main


def test_convert_csv_roundtrip(tmp_path: Path):
    csv_path = tmp_path / "in.csv"
    out_path = tmp_path / "out.jsonl"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["Price", "Date", "Postcode", "Lat", "Lng", "Floor"],
        )
        writer.writeheader()
        writer.writerow(
            {
                "Price": "150000",
                "Date": "15/03/2024",
                "Postcode": "G31 4AA",
                "Lat": "55.857",
                "Lng": "-4.198",
                "Floor": "80",
            }
        )

    rc = main(
        [
            "--input",
            str(csv_path),
            "--output",
            str(out_path),
            "--source",
            "ros",
            "--licence",
            "ROS-research",
            "--map",
            "price=Price,date=Date,postcode=Postcode,lat=Lat,lng=Lng,floor_area=Floor",
        ]
    )
    assert rc == 0
    store = SalesStore.from_jsonl(out_path, allow_synthetic=False)
    assert len(store) == 1
    tx = store.all()[0]
    assert tx.price_gbp == 150000
    assert tx.transfer_date == "2024-03-15"
    assert tx.provenance.is_production_eligible() is True
