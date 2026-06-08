# Scotland AGR Map — Methodology

## What is AGR?

Annual Ground Rent (AGR) is a charge on the **site rental value** of land — the market rent for the land alone, excluding buildings and improvements. SLRG uses the term AGR rather than "land value tax" to emphasise that it recovers **economic rent** the community creates, not a tax on labour or trade.

## Three-layer SLRG calculation

### 1. Roger Sandilands (macro)

- Official GDP accounts show "rent on land" as ~£417m — Sandilands argues true rent is **~50% of GDP**, hidden inside gross operating surplus and conflated with capital returns.
- **ATCOR**: taxes on wages and profits are ultimately absorbed by land rent at productive locations.
- AGR has **zero deadweight loss** (Ramsey rule: land supply is fixed).
- Replacing Scotland Income Tax with rent charges could add **~£11.5bn/year** to GDP (Sandilands 2018).

### 2. Andy Wightman (site valuation)

Per-site land value uses the **residual method**:

```
site_value = market_price − depreciated_replacement_cost_of_buildings
annual_rental = site_value × yield_rate (typically 5%)
```

Valuation rules:
- **Highest and Best Use** = authorised planning consent, not hope value
- For most sites, HABU = existing use
- Rural fallback: land use category benchmarks (Figure 8, HPI-adjusted)

### 3. Duncan Pickard (charge adjustment)

Market land prices are **inflated by speculation**. AGR charges use **economic rental value**:

| Land type | Distortion | Correction |
|-----------|------------|------------|
| Farmland | Market ~5× productive value | Use productive value (e.g. £16/acre not £80) |
| Urban | Help to Buy, property tax favours | De-speculation discount (~70%) |

Marginal land (Ricardo/Sandilands): peripheral locations with no locational surplus → **near-zero AGR**.

## Per-square formula (W3W 3×3 m)

```
1. Snap lat/lng to 3m W3W grid cell (9 sqm)
2. site_capital_per_sqm = residual_method(location)     [Wightman]
3. despeculated = site_capital × discount_factor          [Pickard]
4. annual_rental_per_sqm = despeculated × 0.05
5. AGR = annual_rental_per_sqm × 9 × capture_rate
```

## Data sources (Phase 1+)

| Dataset | Source | Use |
|---------|--------|-----|
| Property transactions | ROS open data | Residual valuation |
| HPI by area | ROS | Zone base rates |
| Planning zones | Spatial Hub / LDP | HABU |
| Cadastral parcels | ROS INSPIRE | Parcel area |
| Postcodes | ONSPD | Search |

## References

- [Sandilands — The Hidden Potential of Rents](https://slrg.scot/blog/wp-content/uploads/2020/05/THE-HIDDEN-POTENTIAL-OF-RENTS-Scotland-2015b.docx)
- [Sandilands — Rent is half of GDP](https://slrg.scot/blog/rent-is-half-of-gdp/)
- [Pickard — Calculating AGR charges](https://slrg.scot/blog/calculating-agrlvt-charges-when-council-tax-and-income-tax-are-replaced/)
- [Wightman — A Land Value Tax for Scotland](https://andywightman.scot/docs/LVTREPORT.pdf)
- [Scottish Land Commission — LVT policy options](https://www.landcommission.gov.scot/downloads/5dd6984da0491_Land-Value-Tax-Policy-Options-for-Scotland-Final-Report-23-7-18.pdf)

## Disclaimer

Research estimate pending SLRG economist sign-off. Not an official tax assessment.