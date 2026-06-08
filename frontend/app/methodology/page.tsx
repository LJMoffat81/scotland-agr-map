export default function MethodologyPage() {
  return (
    <main style={{ maxWidth: 820, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Methodology</h1>
      <p>
        Scotland AGR Map estimates Annual Ground Rent (AGR) for each What3Words
        3×3 metre square using the SLRG methodology stack:
      </p>
      <ul>
        <li>
          <strong>Roger Sandilands</strong> — macro rent theory, ATCOR, zero
          deadweight loss, Scotland GDP scenarios
        </li>
        <li>
          <strong>Andy Wightman</strong> — site valuation (residual method,
          HABU, land use categories)
        </li>
        <li>
          <strong>Duncan Pickard</strong> — de-speculation adjustment (economic
          rent, not inflated market price)
        </li>
      </ul>
      <p>
        Phase 0 uses placeholder zone values. Phase 1 wires ROS transactions,
        HPI zones, and LDP planning data.
      </p>
      <p>
        <a href="/">Back to map</a>
      </p>
    </main>
  );
}