'use client'

/**
 * Model chooser bound to the SHARED catalog — a select of real model ids, with a
 * free-text id fallback when the catalog is unavailable, so a model can always be
 * chosen (and a hand-typed id stays selectable even if it isn't in the list).
 */
import { FieldSelect, FieldText } from '@hanzo/ui/product'

export function ModelSelect({
  value,
  ids,
  onChange,
  disabled,
  placeholder = 'model id, e.g. zen5-mini',
}: {
  value: string
  ids: string[]
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  if (ids.length > 0) {
    const options = !value || ids.includes(value) ? ids : [value, ...ids]
    return <FieldSelect value={value} options={options} onChange={onChange} disabled={disabled} />
  }
  return <FieldText value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
}
