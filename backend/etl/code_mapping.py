"""Map current HPI council codes to boundary dataset codes (LAD13 vintage)."""

from __future__ import annotations

# HPI / current official code -> boundary file code (UK-GeoJSON LAD13)
HPI_TO_BOUNDARY: dict[str, str] = {
    "S12000033": "S12000033",
    "S12000034": "S12000034",
    "S12000041": "S12000041",
    "S12000035": "S12000035",
    "S12000005": "S12000005",
    "S12000006": "S12000006",
    "S12000042": "S12000042",
    "S12000008": "S12000008",
    "S12000045": "S12000045",
    "S12000010": "S12000010",
    "S12000011": "S12000011",
    "S12000036": "S12000036",
    "S12000014": "S12000014",
    "S12000047": "S12000015",   # Fife
    "S12000049": "S12000046",   # Glasgow
    "S12000017": "S12000017",
    "S12000018": "S12000018",
    "S12000019": "S12000019",
    "S12000020": "S12000020",
    "S12000013": "S12000013",   # Na h-Eileanan Siar / Eilean Siar
    "S12000021": "S12000021",
    "S12000050": "S12000044",   # North Lanarkshire
    "S12000023": "S12000023",
    "S12000048": "S12000024",   # Perth and Kinross
    "S12000038": "S12000038",
    "S12000026": "S12000026",
    "S12000027": "S12000027",
    "S12000028": "S12000028",
    "S12000029": "S12000029",
    "S12000030": "S12000030",
    "S12000039": "S12000039",
    "S12000040": "S12000040",
}

BOUNDARY_TO_HPI: dict[str, str] = {boundary: hpi for hpi, boundary in HPI_TO_BOUNDARY.items()}

BOUNDARY_NAME_TO_HPI_NAME: dict[str, str] = {
    "Eilean Siar": "Na h-Eileanan Siar",
    "Glasgow City": "City of Glasgow",
    "Dundee City": "City of Dundee",
    "Aberdeen City": "City of Aberdeen",
    "City of Edinburgh": "City of Edinburgh",
}