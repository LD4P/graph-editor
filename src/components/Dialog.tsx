import { useState } from "react";
import { useDialogStore } from "../state/dialogStore";

export default function Dialog() {
  const request = useDialogStore((state) => state.request);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const [values, setValues] = useState<Record<string, string>>({});

  if (!request) return null;

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function valueFor(field: { name: string; defaultValue?: string }) {
    return values[field.name] ?? field.defaultValue ?? "";
  }

  function handleSubmit() {
    const resolved: Record<string, string> = {};
    for (const field of request!.fields) {
      resolved[field.name] = valueFor(field);
    }
    request!.onSubmit(resolved);
    setValues({});
    closeDialog();
  }

  function handleCancel() {
    setValues({});
    closeDialog();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          background: "white",
          borderRadius: 6,
          padding: "1rem",
          minWidth: 320,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>{request.title}</h3>
        {request.fields.map((field, index) => (
          <label key={field.name} style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
            {field.label}
            <input
              autoFocus={index === 0}
              list={field.options ? `${field.name}-options` : undefined}
              value={valueFor(field)}
              placeholder={field.placeholder}
              onChange={(event) => setValue(field.name, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
                if (event.key === "Escape") handleCancel();
              }}
            />
            {field.options && (
              <datalist id={`${field.name}-options`}>
                {field.options.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </label>
        ))}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={handleCancel}>Cancel</button>
          <button onClick={handleSubmit}>OK</button>
        </div>
      </div>
    </div>
  );
}
