import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { Image as ImageIcon, MessageSquareQuote, Link2, Radio, Megaphone, ChevronRight, Settings2, Smartphone, Eye, Check, Save } from "lucide-react-native";
import { AdminCrud, type AdminCrudConfig } from "@/components/admin/AdminCrud";
import { AdminShell } from "@/components/admin/Shell";
import { AButton, ACard, AField, AInput, ALoading, APanel, AToggleRow, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { cmsApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { rowId } from "@/lib/format";

type Key = "banners" | "testimonials" | "links" | "live" | "promos" | "settings" | "apppromo";

/** Publish / approve buttons, shared by every content type that has them. */
function pubActions(
  publish: (id: string, q: any) => Promise<any>,
  approve?: (id: string, q: any) => Promise<any>
): AdminCrudConfig["rowActions"] {
  return (row: any, { reload }) => (
    <>
      {approve && !row.is_approved ? (
        <AButton label="Approve" size="sm" variant="secondary" icon={<Check size={13} />} onPress={async () => { try { await approve(rowId(row), { approve: true }); reload(); } catch {} }} />
      ) : null}
      <AButton
        label={row.is_published ? "Unpublish" : "Publish"}
        size="sm"
        variant={row.is_published ? "secondary" : "primary"}
        icon={<Eye size={13} color={row.is_published ? undefined : "#fff"} />}
        onPress={async () => { try { await publish(rowId(row), { publish: !row.is_published }); reload(); } catch {} }}
      />
    </>
  );
}

const pubBadge = (r: any) => ({
  label: r.is_published ? "Live" : r.is_approved ? "Approved" : "Draft",
  tone: (r.is_published ? "success" : r.is_approved ? "brand" : "neutral") as any,
});

export default function AdminWebsite() {
  const { c } = useTheme();
  const [section, setSection] = useState<Key | null>(null);

  if (section === "settings") return <SiteSettings onBack={() => setSection(null)} />;
  if (section === "apppromo") return <AppPromo onBack={() => setSection(null)} />;
  if (section) {
    const cfg = CONFIGS[section as Exclude<Key, "settings" | "apppromo">](() => setSection(null));
    return <AdminCrud config={cfg} />;
  }

  const items: { key: Key; label: string; desc: string; Icon: any }[] = [
    { key: "banners", label: "Sponsor banners", desc: "Partner logos & promos", Icon: ImageIcon },
    { key: "testimonials", label: "Testimonials", desc: "Voices from performers", Icon: MessageSquareQuote },
    { key: "links", label: "Important links", desc: "Footer & quick links", Icon: Link2 },
    { key: "live", label: "Live events", desc: "On-air streams", Icon: Radio },
    { key: "promos", label: "Contest promos", desc: "Promoted competitions", Icon: Megaphone },
    { key: "apppromo", label: "App promotion", desc: "Store badges & copy", Icon: Smartphone },
    { key: "settings", label: "Site settings", desc: "Brand & metadata", Icon: Settings2 },
  ];

  return (
    <AdminShell  title="Website content" subtitle={undefined as any}>
      <T size={13.5} mut style={{ marginBottom: 16 }}>Edit every section of the public app in real time.</T>
      <View style={{ gap: 12 }}>
        {items.map((it) => (
          <Pressable key={it.key} onPress={() => setSection(it.key)}>
            <ACard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
                  <it.Icon size={20} color={c.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={15.5} font="bold">{it.label}</T>
                  <T size={12.5} mut style={{ marginTop: 2 }}>{it.desc}</T>
                </View>
                <ChevronRight size={18} color={c.fgSubtle} />
              </View>
            </ACard>
          </Pressable>
        ))}
      </View>
    </AdminShell>
  );
}

const CONFIGS: Record<Exclude<Key, "settings" | "apppromo">, (onBack: () => void) => AdminCrudConfig> = {
  banners: (onBack) => ({
    onBack, title: "Sponsor banners", singular: "Banner", eyebrow: "Website content",
    load: () => cmsApi.listBanners(), create: (b) => cmsApi.createBanner(b), update: (id, b) => cmsApi.updateBanner(id, b), remove: (id) => cmsApi.deleteBanner(id),
    searchKeys: ["title", "sponsor_name"],
    primary: (r) => r.title, secondary: (r) => r.sponsor_name,
    badge: pubBadge, rowActions: pubActions(cmsApi.publishBanner),
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "image_url", label: "Image URL", type: "url", required: true },
      { name: "sponsor_name", label: "Sponsor name" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "target_url", label: "Link URL", type: "url" },
    ],
  }),
  testimonials: (onBack) => ({
    onBack, title: "Testimonials", singular: "Testimonial", eyebrow: "Website content",
    load: () => cmsApi.listTestimonials(), create: (b) => cmsApi.createTestimonial(b), update: (id, b) => cmsApi.updateTestimonial(id, b), remove: (id) => cmsApi.deleteTestimonial(id),
    searchKeys: ["person_name", "role"],
    primary: (r) => r.person_name, secondary: (r) => r.role || r.message,
    badge: pubBadge, rowActions: pubActions(cmsApi.publishTestimonial, cmsApi.approveTestimonial),
    fields: [
      { name: "person_name", label: "Name", required: true },
      { name: "role", label: "Role / title" },
      { name: "profile_image", label: "Photo URL", type: "url" },
      { name: "message", label: "Message", type: "textarea", required: true },
    ],
  }),
  links: (onBack) => ({
    onBack, title: "Important links", singular: "Link", eyebrow: "Website content",
    load: () => cmsApi.listLinks(), create: (b) => cmsApi.createLink(b), update: (id, b) => cmsApi.updateLink(id, b), remove: (id) => cmsApi.deleteLink(id),
    searchKeys: ["title", "label"],
    primary: (r) => r.title || r.label, secondary: (r) => r.url,
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "url", label: "URL", type: "url", required: true },
    ],
  }),
  live: (onBack) => ({
    onBack, title: "Live events", singular: "Live event", eyebrow: "Website content",
    load: () => cmsApi.listLiveEvents(), create: (b) => cmsApi.createLiveEvent(b), update: (id, b) => cmsApi.updateLiveEvent(id, b), remove: (id) => cmsApi.deleteLiveEvent(id),
    searchKeys: ["title"],
    primary: (r) => r.title, secondary: (r) => r.public_url,
    badge: pubBadge, rowActions: pubActions(cmsApi.publishLiveEvent),
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "public_url", label: "Stream URL", type: "url" },
      { name: "image_url", label: "Cover image URL", type: "url" },
      { name: "start_time", label: "Start time", type: "datetime", required: true },
      { name: "end_time", label: "End time", type: "datetime" },
    ],
  }),
  promos: (onBack) => ({
    onBack, title: "Contest promos", singular: "Promo", eyebrow: "Website content",
    load: () => cmsApi.listContestPromos(), create: (b) => cmsApi.createContestPromo(b), update: (id, b) => cmsApi.updateContestPromo(id, b), remove: (id) => cmsApi.deleteContestPromo(id),
    searchKeys: ["title"],
    primary: (r) => r.title, secondary: (r) => r.description,
    badge: pubBadge, rowActions: pubActions(cmsApi.publishContestPromo),
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "image_url", label: "Image URL", type: "url" },
      { name: "target_url", label: "Link URL", type: "url" },
    ],
  }),
};


/* ── Brand, contact and voting, as the web Settings page exposes them ── */
function SiteSettings({ onBack }: { onBack: () => void }) {
  const alert = useAlert();
  const [busy, setBusy] = useState<string | null>(null);
  const settings = useAsync(() => safe(cmsApi.getSettings(), null as any), []);
  const [s, setS] = useState<any>({});

  useEffect(() => { if (settings.data) setS({ ...settings.data }); }, [settings.data]);

  const save = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Saved", ok); }
    catch (e: any) { alert("error", "Couldn't save", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <AdminShell  title="Site settings" onBack={onBack} refreshing={settings.refreshing} onRefresh={settings.refresh}>
      {settings.loading ? <ALoading rows={3} /> : (
        <>
          <APanel title="Brand" action={<AButton label="Save" size="sm" loading={busy === "brand"} icon={<Save size={13} color="#fff" />} onPress={() => save("brand", () => cmsApi.updateSettings(s), "Brand updated.")} />}>
            <AField label="Site name"><AInput value={s.site_name || s.name || ""} onChangeText={(t) => setS((p: any) => ({ ...p, site_name: t }))} placeholder="Upgrade Talents India" /></AField>
            <AField label="Tagline"><AInput value={s.tagline || ""} onChangeText={(t) => setS((p: any) => ({ ...p, tagline: t }))} placeholder="One line under the name" /></AField>
            <AField label="Logo URL"><AInput value={s.logo || s.logo_url || ""} onChangeText={(t) => setS((p: any) => ({ ...p, logo: t }))} autoCapitalize="none" /></AField>
            <AField label="Meta description"><AInput value={s.description || ""} onChangeText={(t) => setS((p: any) => ({ ...p, description: t }))} multiline /></AField>
          </APanel>

        </>
      )}
    </AdminShell>
  );
}

/* ── The "get the app" block on the public site ── */
function AppPromo({ onBack }: { onBack: () => void }) {
  const alert = useAlert();
  const [busy, setBusy] = useState(false);
  const q = useAsync(() => safe(cmsApi.getAppPromo(), null as any), []);
  const [p, setP] = useState<any>({});
  useEffect(() => { if (q.data) setP({ ...q.data }); }, [q.data]);

  const save = async () => {
    setBusy(true);
    try { await cmsApi.updateAppPromo(p); alert("success", "Saved", "App promotion updated."); }
    catch (e: any) { alert("error", "Couldn't save", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell  title="App promotion" onBack={onBack} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? <ALoading rows={2} /> : (
        <APanel title="Promotion block" action={<AButton label="Save" size="sm" loading={busy} icon={<Save size={13} color="#fff" />} onPress={save} />}>
          <AToggleRow label="Show on the site" value={!!p.is_enabled} onChange={(b) => setP((s: any) => ({ ...s, is_enabled: b }))} />
          <AField label="Heading"><AInput value={p.title || ""} onChangeText={(t) => setP((s: any) => ({ ...s, title: t }))} /></AField>
          <AField label="Body"><AInput value={p.description || ""} onChangeText={(t) => setP((s: any) => ({ ...s, description: t }))} multiline /></AField>
          <AField label="App Store URL"><AInput value={p.ios_url || p.app_store_url || ""} onChangeText={(t) => setP((s: any) => ({ ...s, ios_url: t }))} autoCapitalize="none" /></AField>
          <AField label="Play Store URL"><AInput value={p.android_url || p.play_store_url || ""} onChangeText={(t) => setP((s: any) => ({ ...s, android_url: t }))} autoCapitalize="none" /></AField>
          <AField label="Image URL"><AInput value={p.image_url || ""} onChangeText={(t) => setP((s: any) => ({ ...s, image_url: t }))} autoCapitalize="none" /></AField>
        </APanel>
      )}
    </AdminShell>
  );
}
