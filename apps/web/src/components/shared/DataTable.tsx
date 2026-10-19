import type { ReactNode } from 'react';
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}
export function DataTable<T>({
  columns,
  rows,
  keyFor,
  empty = 'No results to display.',
}: {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  empty?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={keyFor(row)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
