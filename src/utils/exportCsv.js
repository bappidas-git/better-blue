// Client-side CSV export — used by the admin reporting screens.
//
// Columns share the `DataTable` shape (`{ key, label }`), so a table and its
// export stay in step. Values are read with the column's `format(row)` when
// given, otherwise `row[key]`; formatting for humans (currency, dates) belongs
// in the caller via `src/utils/formatters.js`.
//
// The download is a Blob + object URL: no server round-trip, nothing leaves the
// browser. A UTF-8 BOM is prepended so Excel opens accented characters
// correctly.

const BOM = '﻿'

/** Escapes a single CSV cell (quotes, commas, and newlines are all safe). */
export function escapeCsvValue(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /["\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Builds the CSV text for `columns` + `rows` (header row included). */
export function toCsv(columns = [], rows = []) {
  const header = columns.map((column) => escapeCsvValue(column.label ?? column.key))
  const body = rows.map((row) =>
    columns.map((column) =>
      escapeCsvValue(
        typeof column.format === 'function' ? column.format(row) : row?.[column.key]
      )
    )
  )
  return [header, ...body].map((cells) => cells.join(',')).join('\r\n')
}

/**
 * Triggers a CSV download.
 * @param {string} filename e.g. `'payouts-2026-08.csv'` (extension added if missing)
 * @param {Array<{ key: string, label?: string, format?: (row: any) => any }>} columns
 * @param {Array<object>} rows
 * @returns {boolean} `false` when there is no document to download through.
 */
export function exportRowsAsCsv(filename, columns = [], rows = []) {
  if (typeof document === 'undefined') return false

  const safeName = String(filename || 'export').trim() || 'export'
  const name = safeName.toLowerCase().endsWith('.csv') ? safeName : `${safeName}.csv`

  try {
    const blob = new Blob([BOM, toCsv(columns, rows)], {
      type: 'text/csv;charset=utf-8;',
    })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = name
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    return true
  } catch {
    return false
  }
}
