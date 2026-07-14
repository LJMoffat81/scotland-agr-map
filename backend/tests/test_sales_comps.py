from agr.config import load_config
from agr.sales_comps import build_sales_comp_report
from agr.service import ValuationService
from datasources.sales_store import SalesStore


def setup_function():
    load_config.cache_clear()


def test_comp_report_from_fixture():
    store = SalesStore.load_default_fixture()
    report = build_sales_comp_report(55.857, -4.198, store)
    assert report.available is True
    assert report.sample_count >= 3
    assert report.synthetic_count >= 1
    assert report.production_ready is False
    assert report.median_price_gbp is not None
    # Floor areas present → extraction residual should produce site shares
    assert report.median_implied_site_share is not None
    assert 0 < report.median_implied_site_share < 1
    assert "synthetic" in report.disclaimer.lower()


def test_service_includes_comp_report():
    service = ValuationService.default()
    ctx = service.sales_context(55.857, -4.198)
    assert ctx["available"] is True
    assert ctx["comp_report"]["method"] == "sales_extraction_residual"
