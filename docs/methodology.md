# Scotland AGR Map — Methodology

## What is AGR?

Annual Ground Rent (AGR) is a charge on the **site rental value** of land — the rent for the land alone, excluding buildings and improvements. SLRG uses the term AGR rather than "land value tax" to emphasise that it recovers **economic rent** the community creates, not a tax on labour or trade.

## Intellectual lineage

Calculation **maths** still run on the operational trio **Wightman → Pickard → Sandilands scenarios**. The wider lineage explains *what* is being measured and *why* it is a legitimate public claim.

### Core layers

| # | Thinker | Role in this tool |
|---|---------|-------------------|
| 1 | **Adam Smith** | Classical **ground-rent**: distinct revenue from location; can specially bear tax without taxing labour or buildings (*Wealth of Nations*). |
| 2 | **David Ricardo** | **Differential rent**: better location yields surplus that accrues as rent — why this square’s AGR exceeds another’s. |
| 3 | **William Ogilvie** | Scottish **equal natural right** in land (1781/82); improvements private; community claim on land rent. |
| 4 | **Henry George** | Full recovery of site rent as primary public revenue (single-tax tradition). |
| 5 | **Mason Gaffney** | **ATCOR / EBCOR** — taxes and excess burdens ultimately load onto land rent at productive locations. |
| 6 | **Fred Harrison** | Land **boom–bust** cycles; market prices capitalise speculation above economic rent. |
| 7 | **Joseph Stiglitz** | **Henry George theorem**: public goods and amenity capitalise into land values. |
| 8 | **Laurie Macfarlane** | Modern **housing = land market**; hope value, financialisation, Scotland/UK policy context. |
| 9 | **Roger Sandilands** | Scotland **macro**: true rent ~50% of GDP; income-tax replacement and growth arguments. |
| 10 | **Andy Wightman** | **Residual / HABU** site capital for Scottish locations. |
| 11 | **Duncan Pickard** | **De-speculation**: charge productive/economic rent, not bubble market price. |

### Satellite references (also see)

| Thinker / body | Role |
|----------------|------|
| **John Stuart Mill** | Unearned increment — social claim on rises in land value from general progress. |
| **Thomas Paine** | *Agrarian Justice* — land rent as basis for an equal citizen dividend. |
| **John McEwen** | *Who Owns Scotland* — ownership concentration and who captures rent. |
| **Churchill (1909 land campaign)** | Historic UK political case against land monopoly. |
| **Scottish Land Commission** | Hope value, public interest, contemporary LVT policy options. |

**Attribution note:** ATCOR/EBCOR are formalised by **Gaffney**. **Sandilands** applies the rent-shift and Scotland GDP case. Market price correction is **Harrison** (cycle/speculation story) + **Pickard** (operational discount).

## Operational calculation (three layers)

### 1. Roger Sandilands (macro)

- Official GDP accounts show "rent on land" as ~£417m — Sandilands argues true rent is **~50% of GDP**, hidden inside gross operating surplus and conflated with capital returns.
- With **Gaffney’s ATCOR**, taxes on wages and profits are ultimately absorbed by land rent at productive locations.
- AGR has **zero deadweight loss** on pure land rent (fixed supply).
- Replacing Scotland Income Tax with rent charges could add **~£11.5bn/year** to GDP (Sandilands 2018).

### 2. Andy Wightman (site valuation)

Per-site land value uses the **residual method** (implemented at council level with HPI):

```
site_value ≈ market_price × site_share   (or full residual: price − DRC of buildings)
annual_rental = site_value × yield_rate (typically 5%)
```

Valuation rules:
- **Highest and Best Use** = authorised planning consent, not hope value
- For most sites, HABU = existing use
- Rural fallback: land use category benchmarks (Figure 8, HPI-adjusted)

### 3. Duncan Pickard (charge adjustment)

Market land prices are **inflated by speculation** (Harrison’s cycle story). AGR charges use **economic rental value**:

| Land type | Distortion | Correction |
|-----------|------------|------------|
| Farmland | Market ~5× productive value | Use productive value (e.g. £16/acre not £80) |
| Urban | Credit, tax design, bubble premia | De-speculation discount (~70%) |

Marginal land (Ricardo/Sandilands): peripheral locations with no locational surplus → **near-zero AGR**.

## Two rent concepts (read this)

| Concept | Source | Used for |
|---------|--------|----------|
| **Map residual AGR** | Wightman residual proxy → Pickard discount → 5% yield | Per-square charge under full AGR and base for scaling |
| **National rent pool** | Sandilands macro (~£90bn / ~50% of GDP) | Equal-share illustration; income-tax **scale factor** only |

**They are not the same number.** Summing all map squares is **not** calibrated to equal the Sandilands pool. Income-tax scenario multiplies map economic rent by `(£11.5bn ÷ £90bn)`. Equal-share divides the **national pool** by population, then compares this square’s **map** rent to that claim.

## Integrity and limitations

1. **Research estimate** — not VOA, ROS, or a rates bill.
2. **Residual is a proxy** — urban path is largely `HPI average × site share ÷ dwelling m²`, not full `price − DRC` on every plot.
3. **Site share** — display default **60% (SLRG)**; Wightman research share **49%** remains in config.
4. **Spatial coarseness** — capital/m² is **council-level** (flat within council) except rural land-use fallbacks; Ricardo differential is national-to-local, not street-level.
5. **HABU aspirational** — HPI embeds credit conditions and some hope value; Pickard discounts are **static** policy knobs (Harrison cycle not modelled year-by-year).
6. **Residential-heavy** — non-domestic urban land is thin; NDR in the revenue-neutral *label* does not mean full commercial cadastral coverage.
7. **Lineage is pedagogical** — Smith through Macfarlane explain *why*; they do not each supply a separate square formula.

Caveats also live in `data/config/agr.yaml` under `integrity.caveats` and are returned on every AGR API response.

## Equal-share illustration (Ogilvie / Paine)

For pedagogy only (does not change the charge formula):

```
equal_share_rent_per_person = estimated_scotland_annual_rent ÷ scotland_population
square_as_fraction_of_equal_claim = map_economic_rent_of_square ÷ equal_share_rent_per_person
```

This frames each square relative to one Scot’s equal annual claim on the **national** rent pool (Ogilvie’s right; Paine’s dividend idea). Population and rent pool live in `data/config/agr.yaml`.

## Per-square formula (W3W 3×3 m)

```
1. Snap lat/lng to 3m W3W grid cell (9 sqm)
2. site_capital_per_sqm = residual_method(location)     [Wightman]
3. despeculated = site_capital × discount_factor          [Pickard]
4. annual_rental_per_sqm = despeculated × 0.05
5. AGR = annual_rental_per_sqm × 9 × capture_rate        [scenario]
6. equal-share stats from national rent pool             [Ogilvie/Paine framing]
```

## Policy scenarios

| Scenario | Idea | Rent base used |
|----------|------|----------------|
| Full AGR | 100% of **map** economic site rent | Map residual only |
| Replace income tax | Scale map rent by £11.5bn ÷ **national pool** | Map × macro ratio |
| Revenue-neutral CT+NDR | Fixed % of **map** de-speculated capital | Map residual capital |

Lineage gloss: full AGR (Smith–George); income tax (Sandilands + Gaffney ATCOR); revenue-neutral (Wightman).

## Data sources (Phase 1+)

| Dataset | Source | Use |
|---------|--------|-----|
| Property transactions | ROS open data | Residual valuation |
| HPI by area | ROS / UK HPI | Zone base rates |
| Planning zones | Spatial Hub / LDP | HABU |
| Cadastral parcels | ROS INSPIRE | Parcel area |
| Postcodes | ONSPD / postcodes.io | Search |

## References

### Classical and Georgist

- Adam Smith — *An Inquiry into the Nature and Causes of the Wealth of Nations* (1776), esp. rent and taxes on ground-rents
- David Ricardo — *On the Principles of Political Economy and Taxation* (1817), law of rent
- William Ogilvie — *An Essay on the Right of Property in Land* (1781/82)
- Henry George — *Progress and Poverty* (1879)
- Mason Gaffney — ATCOR / EBCOR; *The Corruption of Economics* (with Fred Harrison)
- Fred Harrison — *The Power in the Land*; *Boom Bust*; *Ricardo’s Law*
- Joseph Stiglitz — Henry George theorem / capitalisation of public goods into land values
- John Stuart Mill — unearned increment (land value and progress)
- Thomas Paine — *Agrarian Justice* (1797)

### Scotland and contemporary

- [Sandilands — The Hidden Potential of Rents](https://slrg.scot/blog/wp-content/uploads/2020/05/THE-HIDDEN-POTENTIAL-OF-RENTS-Scotland-2015b.docx)
- [Sandilands — Rent is half of GDP](https://slrg.scot/blog/rent-is-half-of-gdp/)
- [Pickard — Calculating AGR charges](https://slrg.scot/blog/calculating-agrlvt-charges-when-council-tax-and-income-tax-are-replaced/)
- [Wightman — A Land Value Tax for Scotland](https://andywightman.scot/docs/LVTREPORT.pdf)
- Josh Ryan-Collins, Toby Lloyd & Laurie Macfarlane — *Rethinking the Economics of Land and Housing* (2017)
- Laurie Macfarlane — [Scottish Land Commission housing land market paper](https://www.landcommission.gov.scot/downloads/5de1a716b632b_Land-Lines-Discussion-Paper-Housing-Land-Market-Dec-2017.pdf)
- [Scottish Land Commission — LVT policy options](https://www.landcommission.gov.scot/downloads/5dd6984da0491_Land-Value-Tax-Policy-Options-for-Scotland-Final-Report-23-7-18.pdf)
- John McEwen — *Who Owns Scotland*

## Disclaimer

Research estimate with SLRG economist sign-off on **charge parameters** (macro, site share, despeculation, scenarios). Intellectual lineage and integrity caveats are pedagogical and do not by themselves alter residual maths. Not an official tax assessment or rates bill.
