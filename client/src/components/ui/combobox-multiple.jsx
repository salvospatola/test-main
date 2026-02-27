import * as React from "react"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

export function ComboboxMultiple({ options = [], selected = [], onChange, placeholder = "Wählen...", className }) {
  const anchor = useComboboxAnchor()

  // Support for adding custom items if they don't exist
  const handleAddCustom = (val) => {
    if (!val) return;
    if (!selected.includes(val)) {
      onChange([...selected, val])
    }
  }

  // Map options to strings if items are simple
  const items = options.map(o => o.value || o)

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={selected}
      onValueChange={onChange}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(values) => (
            <React.Fragment>
              {values.map((value) => (
                <ComboboxChip key={value} onRemove={() => onChange(values.filter(v => v !== value))}>
                  {options.find(o => o.value === value)?.label || value}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput placeholder={placeholder} onEnter={handleAddCustom} />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Keine Ergebnisse. Drücke Enter zum Hinzufügen.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {options.find(o => o.value === item)?.label || item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
