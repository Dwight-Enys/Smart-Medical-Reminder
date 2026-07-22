import { useMemo, useState } from 'react'

export interface DataGridColumn<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  width?: string
}

interface DataGridProps<T> {
  columns: DataGridColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  dense?: boolean
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export default function DataGrid<T>({
  columns,
  rows,
  rowKey,
  searchable = true,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No records to display.',
  onRowClick,
  dense = false,
}: DataGridProps<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const raw = col.sortValue ? col.sortValue(row) : (row as any)[col.key]
        return raw != null && String(raw).toLowerCase().includes(q)
      })
    )
  }, [rows, query, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      const va = col.sortValue ? col.sortValue(a) : (a as any)[col.key]
      const vb = col.sortValue ? col.sortValue(b) : (b as any)[col.key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sort, columns])

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div className="card overflow-hidden">
      {searchable && (
        <div className="p-3 border-b border-slate-200">
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              className="input pl-9"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{ width: col.width }}
                  className={`${cellPad} text-xs font-semibold text-slate-500 uppercase tracking-wide select-none cursor-pointer whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sort?.key === col.key && (
                      <span className="text-slate-400">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-slate-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${cellPad} text-slate-700 align-middle ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
