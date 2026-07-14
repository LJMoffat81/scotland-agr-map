from pathlib import Path

from agr.service import ValuationService
from datasources.sales_schema import SalesProvenance, SalesTransaction
from datasources.sales_store import SalesStore


def test_fixture_loads_and_validates():
    store = SalesStore.load_default_fixture()
    assert len(store) >= 5
    summary = store.summary()
    assert summary["synthetic_count"] == summary["count"]
    assert summary["production_eligible_count"] == 0


def test_synthetic_not_production_eligible():
    store = SalesStore.load_default_fixture()
    assert store.production_eligible() == []


def test_nearest_in_ward18_area():
    store = SalesStore.load_default_fixture()
    nearest = store.nearest(55.857, -4.198, limit=5, max_km=2.0)
    assert len(nearest) >= 1
    assert nearest[0][0] < 2.0


def test_transaction_validate_price():
    tx = SalesTransaction(
        transaction_id="x",
        price_gbp=0,
        transfer_date="2024-01-01",
        lat=55.8,
        lng=-4.2,
        postcode=None,
        property_type=None,
        new_build=None,
        floor_area_sqm=None,
        plot_area_sqm=None,
        tenure=None,
        council_code=None,
        provenance=SalesProvenance(
            source_system="fixture_synthetic",
            licence="synthetic-test-only",
            retrieved_at="2026-07-14",
        ),
    )
    assert "price_gbp must be positive" in tx.validate()


def test_valuation_service_sales_context():
    service = ValuationService.default()
    ctx = service.sales_context(55.857, -4.198)
    assert ctx["available"] is True
    assert ctx["count"] >= 1
    assert ctx["nearest"][0]["production_eligible"] is False


def test_ingest_cli(tmp_path: Path):
    from etl.ingest_sales import main

    fixture = (
        Path(__file__).resolve().parents[2]
        / "data"
        / "fixtures"
        / "sales"
        / "ward18_synthetic.jsonl"
    )
    assert main(["--path", str(fixture)]) == 0
