import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-pw-line bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-pw-brand-soft text-[0.9375rem] uppercase tracking-[0.045em] text-pw-ink">
          <tr>
            {columns.map((column) => (
              <th
                className="border-b border-pw-brand/35 px-4 py-3.5 font-extrabold"
                scope="col"
                key={column.key}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pw-line">
          {rows.map((row) => (
            <tr className="hover:bg-pw-brand-soft/40" key={rowKey(row)}>
              {columns.map((column) => (
                <td className="px-4 py-3" key={column.key}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
