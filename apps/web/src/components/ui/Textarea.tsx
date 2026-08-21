import type { TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Textarea({ label, error, className = '', id, ...props }: Props) {
  const areaId = id ?? label.replace(/\s/g, '-')
  return (
    <label className="block" htmlFor={areaId}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        id={areaId}
        rows={3}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
