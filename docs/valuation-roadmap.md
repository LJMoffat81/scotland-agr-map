# Valuation roadmap — toward a true AGR roll

## Current state (v0.5)

Open-data **valuer residual approximation**:

```text
HABU existing use → MV (council HPI) − DRC → Pickard economic capital → × 5% yield
```

Good enough for public education and SLRG-aligned methodology. Not yet a sales-calibrated national roll.

## Why Doucet / OpenAVMKit next

[Lars Doucet](https://landeconomics.org/home) and the Center for Land Economics maintain **[OpenAVMKit](https://www.openavmkit.com/)** — free/open mass appraisal:

- Sales cleaning and scrutiny  
- Spatial enrichment (OSM, footprints, distances)  
- Land vs improved value modeling (abstraction / residual family)  
- MRA, GWR, gradient-boosted AVMs  
- IAAO-style ratio studies  

That is the professional path from **council flat residual** to **neighbourhood / parcel land values** without abandoning SLRG policy (Pickard, HABU, Sandilands scenarios).

Martin Adams / [Unitism](https://unitism.com/) does not change residual maths; it strengthens **why** we collect land rent and **how** revenue can return (services + optional citizen dividend). Already reflected in equal-share framing.

## Proposed phases

| Phase | Goal | Data need | Output |
|-------|------|-----------|--------|
| **A** (done) | Valuer residual DRC + lineage | HPI, rebuild config | Grid / plot / parcel roll lines |
| **A2** (done) | Clarity UI + W3W identity | — | Plot headline, W3W cell line, deep links |
| **A3** (done) | Trust: sensitivity + Ward 18 story | API overrides | Yield / Pickard sliders; Ward 18 validation blurb |
| **A4** (done) | Professional foundations | Sales schema, licensing, `ValuationService` | ROS-ready pipeline; synthetic fixtures for CI |
| **A5** (done) | Sales comps cross-check | Extraction residual on nearby sales | Research UI; production only when licensed |
| **A6** (done) | Assessment reports + ratio-study API | Markdown/JSON export; Ward 18 QA structure | Professional deliverable pack |
| **B** | Ward 18 pilot sales residual | **ROS licensed/open sales** + parcels | Compare OpenAVMKit land vs residual |
| **C** | Council pilot mass appraisal | Clean sales, land use, building footprints | Neighbourhood land surface |
| **D** | Multi-council roll prototype | Repeatable pipeline | Ratio studies + map layers |
| **E** | Optional incidence UI | CT/NDR baselines | Who pays more/less (CLE-style) |

## Guardrails (keep SLRG spine)

1. **Policy layers stay Scottish:** Pickard economic rent, Sandilands macro scenarios, AGR not “property tax”.  
2. **OpenAVMKit improves site capital**, not the meaning of full AGR.  
3. **Unitism language** is framing (community land contribution / dividend), not a second tax formula.  
4. **Macro pool (£90bn) remains separate** from sum of roll cells until explicitly calibrated.

## Pilot checklist (Phase B)

- [ ] Export Glasgow Ward 18 parcels + sales window  
- [ ] Install OpenAVMKit in a research venv (not required for production API)  
- [ ] Run land-value model + ratio study  
- [ ] Diff vs `residual_drc` on same points  
- [ ] Document bias (coastal, tenements, voids)  
- [ ] Decide whether to blend or replace council residual for that ward only  

## References

- Adams — [unitism.com](https://unitism.com/) · *Land: A New Paradigm for a Thriving World*  
- Doucet — *Land is a Big Deal* · [Progress & Poverty](https://progressandpoverty.substack.com)  
- CLE — [landeconomics.org](https://landeconomics.org/home)  
- OpenAVMKit — [openavmkit.com](https://www.openavmkit.com/) · [GitHub](https://github.com/larsiusprime/openavmkit)  
