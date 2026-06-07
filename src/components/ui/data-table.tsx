import type { ReactNode } from "react";

interface DataTableProps {
  headers: string[];
  rows: ReactNode[][];
  caption: string;
}

export function DataTable({ headers, rows, caption }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/70 text-xs uppercase tracking-wide text-subdued">
          <tr>
            {headers.map((header) => (
              <th className="border-b px-4 py-3 font-semibold" key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-b last:border-b-0 hover:bg-muted/30" key={index}>
              {row.map((cell, cellIndex) => (
                <td className="px-4 py-3" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
