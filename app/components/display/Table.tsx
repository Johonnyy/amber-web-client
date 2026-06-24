"use client";

import type { TablePayload } from "@/lib/displayTypes";

/** A rows/columns table — comparisons, schedules, standings. */
export function Table({ payload }: { payload: TablePayload }) {
  const columns = payload.columns || [];
  const rows = payload.rows || [];
  const align = payload.align || [];
  return (
    <div className="d-block">
      {payload.title && <h3 className="d-title">{payload.title}</h3>}
      <div className="d-table-wrap">
        <table className="d-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} style={{ textAlign: align[i] || "left" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ textAlign: align[c] || "left" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
