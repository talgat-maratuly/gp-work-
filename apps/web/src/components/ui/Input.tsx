import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: Props) {
  const inputId = id ?? label.replace(/\s/g, '-')
  return (
    <label className="block" htmlFor={inputId}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        id={inputId}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
