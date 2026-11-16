import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { Pencil, Trash2, Plus } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import {
  useAdmin, T, AButton, ABadge, AList, ARow, AModal, AField, AInput, AToggle, ASelect, AErrorState, type Tone,
} from "@/components/admin/ui";
import { useAlert } from "@/components/Popup";
import { toRows } from "@/lib/api";
import { rowId, toDateInput, toDateTimeInput } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export type AdminField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "datetime" | "select" | "toggle" | "email" | "url";
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: any;
};

export type AdminCrudConfig<T = any> = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  singular: string;
  load: () => Promise<any>;
  create?: (body: any) => Promise<any>;
  update?: (id: string, body: any) => Promise<any>;
  remove?: (id: string) => Promise<any>;
  primary: (row: T) => string;
  secondary?: (row: T) => string | null | undefined;
  meta?: (row: T) => { label: string; value: string }[];
  badge?: (row: T) => { label: string; tone: Tone } | null;
  searchKeys?: string[];
  fields?: AdminField[];
  rowActions?: (row: T, ctx: { reload: () => void }) => React.ReactNode;
  /** Id used for update/remove calls; defaults to rowId(). */
  idOf?: (row: T) => string;
  /** Overrides the back button (used by hubs that embed a CRUD). */
  onBack?: () => void;
  toBody?: (values: Record<string, any>, editing: T | null) => any;
  toForm?: (row: T) => Record<string, any>;
  emptyBody?: string;
  /** Label for the CRUD list itself when extra tabs are present. */
  listTab?: string;
  /**
   * Extra panels shown beside the list. The web admin puts analytics, orders
   * and config side by side; on a phone they become tabs over the same page.
   */
  extraTabs?: { key: string; label: string; render: (ctx: { reload: () => void }) => React.ReactNode }[];
};

export function AdminCrud<T extends Record<string, any>>({ config }: { config: AdminCrudConfig<T> }) {
  const { load, create, update, remove, fields = [], searchKeys, title, subtitle, eyebrow, singular, primary, secondary, meta, badge, rowActions, idOf, toBody, toForm, emptyBody, extraTabs, listTab = "List" } = config;
  const idFor = (row: T) => (idOf ? idOf(row) : rowId(row));

  const { data, loading, error, refreshing, refresh, reload } = useAsync(load, []);
  const rows = useMemo(() => toRows(data) as T[], [data]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState("__list");
  const onList = !extraTabs?.length || tab === "__list";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const alert = useAlert();

  const filtered = useMemo(() => {
    if (!q.trim() || !searchKeys) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
  }, [rows, q, searchKeys]);

  const blank = useCallback(() => {
    const v: Record<string, any> = {};
    fields.forEach((f) => { v[f.name] = f.defaultValue ?? (f.type === "toggle" ? false : ""); });
    return v;
  }, [fields]);

  const openCreate = () => { setEditing(null); setValues(blank()); setErrors({}); setOpen(true); };
  const openEdit = (row: T) => {
    setEditing(row);
    const pre = toForm ? toForm(row) : {};
    const v: Record<string, any> = {};
    fields.forEach((f) => {
      const raw = pre[f.name] ?? row[f.name];
      v[f.name] = f.type === "toggle" ? !!raw : f.type === "date" ? toDateInput(raw) : f.type === "datetime" ? toDateTimeInput(raw) : raw ?? "";
    });
    setValues(v); setErrors({}); setOpen(true);
  };

  const flash = (tone: "success" | "error", msg: string) => {
    alert(tone, (tone === "success" ? "Done" : "Something went wrong"), msg);
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      if (!f.required || f.type === "toggle") return;
      const v = values[f.name];
      if (v === "" || v === undefined || v === null) errs[f.name] = `${f.label} is required.`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body = toBody
      ? toBody(values, editing)
      : Object.fromEntries(fields.map((f) => [f.name, f.type === "number" ? (values[f.name] === "" ? undefined : Number(values[f.name])) : values[f.name]]));

    setBusy(true);
    try {
      if (editing && update) { await update(idFor(editing), body); flash("success", `${singular} updated.`); }
      else if (create) { await create(body); flash("success", `${singular} created.`); }
      setOpen(false);
      reload();
    } catch (e: any) {
      setErrors({ _form: e?.message || "Could not save. Please try again." });
    } finally { setBusy(false); }
  };

  const del = async (row: T) => {
    if (!remove) return;
    setBusy(true);
    try { await remove(idFor(row)); flash("success", `${singular} deleted.`); reload(); }
    catch (e: any) { flash("error", e?.message || "Could not delete."); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell
      title={title}
      subtitle={subtitle}
      refreshing={refreshing}
      onRefresh={refresh}
      onBack={config.onBack}
      action={create && onList ? <AButton label="New" size="sm" icon={<Plus size={15} color="#fff" />} onPress={openCreate} /> : undefined}
    >
      {extraTabs?.length ? (
        <CrudTabs
          value={tab}
          onChange={setTab}
          tabs={[{ key: "__list", label: listTab }, ...extraTabs.map((t) => ({ key: t.key, label: t.label }))]}
        />
      ) : null}

      {!onList ? (
        extraTabs?.find((t) => t.key === tab)?.render({ reload }) ?? null
      ) : (
        <AList
          rows={filtered}
          loading={loading}
          error={error}
          onRetry={reload}
          search={searchKeys ? q : undefined}
          onSearch={searchKeys ? setQ : undefined}
          searchPlaceholder={`Search ${title.toLowerCase()}`}
          keyOf={(row: any, i) => idFor(row) || String(i)}
          empty={{ title: `No ${title.toLowerCase()} yet`, body: emptyBody }}
          renderRow={(row: any) => {
            const b = badge?.(row);
            return (
              <ARow
                title={primary(row)}
                subtitle={secondary?.(row) || undefined}
                badge={b ? <ABadge tone={b.tone}>{b.label}</ABadge> : undefined}
                cells={meta?.(row)?.map((m) => ({ label: m.label, value: m.value }))}
                actions={
                  rowActions || update || remove ? (
                    <>
                      {rowActions?.(row, { reload })}
                      {update && fields.length ? <AButton label="Edit" size="sm" variant="secondary" icon={<Pencil size={13} />} onPress={() => openEdit(row)} /> : null}
                      {remove ? <DeleteButton onPress={() => del(row)} /> : null}
                    </>
                  ) : undefined
                }
              />
            );
          }}
        />
      )}

      <AModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
        subtitle={editing ? "Changes go live as soon as you save." : undefined}
        footer={
          <>
            <AButton label="Cancel" variant="secondary" size="sm" onPress={() => setOpen(false)} />
            <AButton label={editing ? "Save changes" : "Create"} size="sm" loading={busy} onPress={submit} />
          </>
        }
      >
        {errors._form ? <View style={{ marginBottom: 14 }}><AErrorState message={errors._form} /></View> : null}
        {fields.map((f) => (
          <FormControl key={f.name} field={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
        ))}
      </AModal>
    </AdminShell>
  );
}

function DeleteButton({ onPress }: { onPress: () => void }) {
  const c = useAdmin();
  return <AButton label="Delete" size="sm" variant="ghost" icon={<Trash2 size={13} color={c.danger} />} onPress={onPress} />;
}

/** Pill tabs in the control room's own chrome. */
function CrudTabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const c = useAdmin();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center", borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brandSoft : c.surface }}
          >
            <T size={12.5} font="semi" color={on ? c.brand : c.fgMuted}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormControl({ field, value, error, onChange }: { field: AdminField; value: any; error?: string; onChange: (v: any) => void }) {
  if (field.type === "toggle") {
    return (
      <View style={{ marginBottom: 14 }}>
        <AToggle label={field.label} checked={!!value} onChange={onChange} />
        {field.hint ? <T size={11.5} sub style={{ marginTop: 6 }}>{field.hint}</T> : null}
      </View>
    );
  }
  if (field.type === "select") {
    return (
      <AField label={field.label} hint={field.hint} error={error} required={field.required}>
        <ASelect value={value === undefined || value === null ? "" : String(value)} options={field.options || []} onChange={onChange} />
      </AField>
    );
  }
  const multiline = field.type === "textarea";
  const keyboardType = field.type === "number" ? "numeric" : field.type === "email" ? "email-address" : field.type === "url" ? "url" : "default";
  return (
    <AField label={field.label} hint={field.hint} error={error} required={field.required}>
      <AInput
        value={value === undefined || value === null ? "" : String(value)}
        onChangeText={onChange}
        placeholder={field.placeholder || (field.type === "date" ? "YYYY-MM-DD" : field.type === "datetime" ? "YYYY-MM-DDTHH:mm" : "")}
        multiline={multiline}
        autoCapitalize={field.type === "email" || field.type === "url" ? "none" : "sentences"}
        keyboardType={keyboardType as any}
        invalid={!!error}
      />
    </AField>
  );
}
