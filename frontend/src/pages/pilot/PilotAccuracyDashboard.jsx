import { useCallback, useEffect, useState } from "react";
import { fetchPilotAnalytics } from "@/services/phoneOrderPilotApi";

/**
 * Pilot accuracy dashboard.
 *
 * Read-only, and deliberately blunt about one thing: the AI's own confidence is
 * not accuracy. It is shown as a separate, labelled number so it can never be
 * mistaken for a correctness score. Accuracy comes from what the supplier
 * actually had to fix.
 *
 * Nothing here writes, and nothing here touches a real order.
 */

const pct = (value) => (typeof value === "number" ? `${value}%` : "-");

const num = (value) => (typeof value === "number" ? value.toLocaleString("en-IN") : "0");

const conf = (value) => {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
};

const dateLabel = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const panel = {
  border: "1px solid #e5e7eb",
  borderRadius: "0.75rem",
  background: "#ffffff",
  padding: "1rem",
};

const StatCard = ({ label, value, sub }) => (
  <div style={{ ...panel, minWidth: "0" }}>
    <div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    {sub ? <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{sub}</div> : null}
  </div>
);

export default function PilotAccuracyDashboard({ onOpenCall }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(() => fetchPilotAnalytics(), []);

  const message = (err) =>
    err?.response?.data?.message || "Could not load pilot analytics.";

  // State is only ever set from a promise callback, never synchronously in the
  // effect body, so mounting does not trigger a cascading render.
  useEffect(() => {
    let active = true;
    fetchReport().then(
      (data) => {
        if (active) setReport(data);
      },
      (err) => {
        if (active) setError(message(err));
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchReport]);

  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    fetchReport().then(
      (data) => setReport(data),
      (err) => setError(message(err)),
    ).finally(() => setLoading(false));
  }, [fetchReport]);

  if (loading) {
    return (
      <section style={{ ...panel, color: "#6b7280" }}>Loading pilot accuracy...</section>
    );
  }

  if (error) {
    return (
      <section style={{ ...panel, borderColor: "#fecaca", color: "#b91c1c" }}>
        {error}
        <button type="button" onClick={reload} style={{ marginLeft: "0.75rem" }}>
          Retry
        </button>
      </section>
    );
  }

  if (!report) return null;

  const calls = report.calls || {};
  const drafts = report.drafts || {};
  const rates = report.rates || {};
  const confidence = report.confidence || {};
  const problems = Array.isArray(report.problems) ? report.problems : [];
  const recent = Array.isArray(report.recent) ? report.recent : [];
  const nothingConfirmed = (report.integrity?.pilotConfirmedDrafts || 0) === 0;

  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Pilot Accuracy</h2>
        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          Confirmed drafts only. No order is ever created from this data.
        </span>
      </header>

      {nothingConfirmed ? (
        <div style={{ ...panel, color: "#6b7280" }}>
          No confirmed drafts yet. Confirm a draft in the Calls tab and the numbers
          will appear here.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
        }}
      >
        <StatCard
          label="Calls tested"
          value={num(calls.total)}
          sub={`${num(calls.confirmed)} confirmed`}
        />
        <StatCard
          label="AI lines"
          value={num(drafts.aiLines)}
          sub={`${num(drafts.confirmedLines)} kept`}
        />
        <StatCard
          label="Corrected"
          value={num(drafts.changedLines)}
          sub={`${pct(rates.correction)} of AI lines`}
        />
        <StatCard
          label="Removed"
          value={num(drafts.removedLines)}
          sub={`${pct(rates.removal)} of AI lines`}
        />
        <StatCard
          label="Manually added"
          value={num(drafts.manualLines)}
          sub={`${pct(rates.manualAdd)} of kept`}
        />
        <StatCard
          label="Avg AI confidence"
          value={conf(confidence.average)}
          sub="self-reported, not accuracy"
        />
        <StatCard
          label="Clean AI lines"
          value={pct(rates.clean)}
          sub="no change needed"
        />
      </div>

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
        <div style={panel}>
          <h3 style={{ marginTop: 0, fontSize: "0.9375rem" }}>Most common problems</h3>
          {problems.length === 0 ? (
            <p style={{ color: "#6b7280", marginBottom: 0 }}>
              No corrections or removals recorded yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
              {problems.map((problem) => (
                <li key={problem.key}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span>{problem.label}</span>
                    <strong>
                      {num(problem.count)}
                      <span style={{ color: "#6b7280", fontWeight: 400 }}>
                        {" "}
                        ({pct(problem.share)})
                      </span>
                    </strong>
                  </div>
                  {problem.hint ? (
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{problem.hint}</div>
                  ) : null}
                  <div
                    style={{
                      height: "0.25rem",
                      background: "#f3f4f6",
                      borderRadius: "999px",
                      marginTop: "0.125rem",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, problem.share)}%`,
                        height: "100%",
                        background: "#f59e0b",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={panel}>
          <h3 style={{ marginTop: 0, fontSize: "0.9375rem" }}>Lines the AI got wrong</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.375rem" }}>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Corrected by supplier</span>
              <strong>{num(drafts.changedLines)}</strong>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Removed as wrong</span>
              <strong>{num(drafts.removedLines)}</strong>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Added by hand</span>
              <strong>{num(drafts.manualLines)}</strong>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Not recognised at all</span>
              <strong>{num(drafts.unresolvedLines)}</strong>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Low-confidence match</span>
              <strong>{num(drafts.ambiguousLines)}</strong>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Variant not stated</span>
              <strong>{num(drafts.uncertainVariantLines)}</strong>
            </li>
          </ul>
          <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: 0 }}>
            "Not recognised" and "low-confidence" include problems the supplier fixed
            before confirming, because they still count against the extraction.
          </p>
        </div>
      </div>

      <div style={panel}>
        <h3 style={{ marginTop: 0, fontSize: "0.9375rem" }}>Recent confirmed calls</h3>
        {recent.length === 0 ? (
          <p style={{ color: "#6b7280", marginBottom: 0 }}>Nothing confirmed yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  {["Call", "AI lines", "Corrections", "Removed", "Added", "Confidence", "Date"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          borderBottom: "1px solid #e5e7eb",
                          padding: "0.375rem 0.5rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.pilotCallId}>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      <button
                        type="button"
                        onClick={() => onOpenCall?.(row.pilotCallId)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "#2563eb",
                          cursor: "pointer",
                          font: "inherit",
                          textAlign: "left",
                        }}
                      >
                        {row.caller}
                      </button>
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      {num(row.aiLines)}
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      {num(row.corrections)}
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      {num(row.removed)}
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      {num(row.added)}
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6" }}>
                      {conf(row.averageConfidence)}
                    </td>
                    <td style={{ padding: "0.375rem 0.5rem", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>
                      {dateLabel(row.confirmedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: 0 }}>
        {Array.isArray(report.notes) ? report.notes.join(" ") : ""}
      </p>
    </section>
  );
}
