import type { SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: { value: string | number; label: string }[]
}

export function Select({ label, error, options, className = '', id, ...props }: Props) {
  const selectId = id ?? label.replace(/\s/g, '-')
  return (
    <label className="block" htmlFor={selectId}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        id={selectId}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
