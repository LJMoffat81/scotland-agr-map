"""Approximate council centroids for nearest-area lookup (Phase 1).

Full boundary polygons arrive in Phase 3 via Spatial Hub / INSPIRE cadastre.
"""

from __future__ import annotations

COUNCIL_CENTROIDS: dict[str, tuple[float, float]] = {
    "S12000033": (57.1497, -2.0943),   # City of Aberdeen
    "S12000034": (57.2000, -2.5000),   # Aberdeenshire
    "S12000041": (56.7000, -2.9000),   # Angus
    "S12000035": (56.2000, -5.1000),   # Argyll and Bute
    "S12000005": (56.1200, -3.7500),   # Clackmannanshire
    "S12000006": (55.1000, -3.6000),   # Dumfries and Galloway
    "S12000042": (56.4620, -2.9707),   # City of Dundee
    "S12000008": (55.6000, -4.3000),   # East Ayrshire
    "S12000045": (55.9500, -4.2000),   # East Dunbartonshire
    "S12000010": (55.9500, -2.7500),   # East Lothian
    "S12000011": (55.7800, -4.3500),   # East Renfrewshire
    "S12000036": (55.9533, -3.1883),   # City of Edinburgh
    "S12000014": (56.0000, -3.7500),   # Falkirk
    "S12000047": (56.2000, -3.1500),   # Fife
    "S12000049": (55.8642, -4.2518),   # City of Glasgow
    "S12000017": (57.5000, -4.2000),   # Highland
    "S12000018": (55.9000, -4.7500),   # Inverclyde
    "S12000019": (55.8500, -3.1000),   # Midlothian
    "S12000020": (57.6000, -3.3000),   # Moray
    "S12000013": (58.2000, -6.4000),   # Na h-Eileanan Siar
    "S12000021": (55.6500, -4.7500),   # North Ayrshire
    "S12000050": (55.8500, -3.9500),   # North Lanarkshire
    "S12000023": (59.0000, -3.0000),   # Orkney Islands
    "S12000048": (56.4000, -3.4000),   # Perth and Kinross
    "S12000038": (55.8500, -4.5000),   # Renfrewshire
    "S12000026": (55.5500, -2.8000),   # Scottish Borders
    "S12000027": (60.2000, -1.2000),   # Shetland Islands
    "S12000028": (55.4500, -4.6000),   # South Ayrshire
    "S12000029": (55.5500, -3.8500),   # South Lanarkshire
    "S12000030": (56.1200, -4.0000),   # Stirling
    "S12000039": (55.9500, -4.5500),   # West Dunbartonshire
    "S12000040": (55.9000, -3.5500),   # West Lothian
}