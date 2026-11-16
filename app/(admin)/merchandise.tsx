import React, { useState } from "react";
import { useAdmin, AButton, ACard, AEmpty, AGrid, AHatchBars, ALoading, APanel, ARecord, AStatTile, ATag, T } from "@/components/admin/ui";
import { View, Pressable } from "react-native";
import { Eye, Archive, ShoppingBag, Package, IndianRupee, TrendingUp, Boxes } from "lucide-react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { useTheme } from "@/theme/ThemeProvider";
import { merchApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { rowId, formatINR, formatEventDate, titleCase } from "@/lib/format";

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export default function AdminMerchandise() {
  const { c } = useTheme();
  return (
    <AdminCrud
      config={{
        title: "Merchandise",
        singular: "Product",
        subtitle: "Catalogue, orders and stock for the merch store.",
        listTab: "Catalogue",
        extraTabs: [
          { key: "orders", label: "Orders", render: () => <Orders /> },
          { key: "stock", label: "Stock", render: () => <Inventory /> },
          { key: "insights", label: "Insights", render: () => <Insights /> },
        ],
        load: () => merchApi.listProducts({ limit: 100 }),
        create: (b) => merchApi.createProduct(b),
        update: (id, b) => merchApi.updateProduct(id, b),
        searchKeys: ["name", "sku", "category"],
        primary: (r) => r.name,
        secondary: (r) => r.category || r.sku,
        badge: (r) => ({ label: titleCase(r.status) || "Draft", tone: r.status === "PUBLISHED" ? "success" : r.status === "ARCHIVED" ? "neutral" : "warning" }),
        meta: (r) => [
          { label: "Price", value: formatINR(r.price) },
          { label: "Stock", value: String(r.stock ?? "—") },
        ],
        rowActions: (row, { reload }) => (
          <>
            <AButton label="Publish" size="sm" variant="primary" icon={<Eye size={13} color={"#fff"} />} onPress={async () => { try { await merchApi.publishProduct(rowId(row)); reload(); } catch {} }} />
            <AButton label="Archive" size="sm" variant="ghost" icon={<Archive size={13} color={c.fgMuted} />} onPress={async () => { try { await merchApi.archiveProduct(rowId(row)); reload(); } catch {} }} />
          </>
        ),
        toBody: (v) => ({
          name: v.name, description: v.description || undefined, sku: v.sku || undefined,
          price: Number(v.price) || 0, stock: Number(v.stock) || 0, category: v.category || undefined, image_url: v.image_url || undefined,
        }),
        fields: [
          { name: "name", label: "Product name", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "sku", label: "SKU" },
          { name: "price", label: "Price (₹)", type: "number", required: true, defaultValue: 0 },
          { name: "stock", label: "Stock quantity", type: "number", required: true, defaultValue: 0 },
          { name: "category", label: "Category", placeholder: "Apparel / Accessories" },
          { name: "image_url", label: "Image URL", type: "url" },
        ],
      }}
    />
  );
}

/* ── Orders: fulfilment moves through the same statuses as the web admin ── */
function Orders() {
  const { c } = useTheme();
  const alert = useAlert();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useAsync(() => safe(merchApi.listOrders({ limit: 200 }), [] as any), []);
  const rows = toRows(q.data);

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    try { await merchApi.setOrderStatus(id, { status }); alert("success", "Order updated", `Marked ${status.toLowerCase()}.`); q.reload(); }
    catch (e: any) { alert("error", "Couldn't update", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  if (q.loading) return <ALoading />;
  if (!rows.length) return <AEmpty icon={<ShoppingBag size={26} color={c.fgMuted} />} title="No orders yet" subtitle="Purchases from the store appear here." />;

  return (
    <View style={{ gap: 12 }}>
      {rows.map((o: any, i: number) => {
        const id = o._id || o.id;
        const status = String(o.status || "PENDING").toUpperCase();
        return (
          <ACard key={id || i}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T size={14.5} font="bold" numberOfLines={1}>{o.order_reference || o.order_ref || `Order ${i + 1}`}</T>
                <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{o.user_email || o.customer_email || ""}</T>
              </View>
              <ATag label={titleCase(status)} tone={status === "DELIVERED" ? "success" : status === "CANCELLED" || status === "REFUNDED" ? "danger" : "warning"} />
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
              <View>
                <T size={10} font="monoMed" sub track={1.5} upper>Total</T>
                <T size={13} font="semi" style={{ marginTop: 1 }}>{formatINR(o.total_amount ?? o.amount ?? 0)}</T>
              </View>
              <View>
                <T size={10} font="monoMed" sub track={1.5} upper>Placed</T>
                <T size={13} font="semi" style={{ marginTop: 1 }}>{formatEventDate(o.created_at)}</T>
              </View>
            </View>

            <T size={10} font="monoMed" sub track={1.5} upper style={{ marginTop: 14, marginBottom: 8 }}>Move to</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ORDER_STATUSES.filter((s) => s !== status).map((s) => (
                <StatusChip key={s} label={titleCase(s)} onPress={() => id && !busy && setStatus(id, s)} />
              ))}
            </View>
          </ACard>
        );
      })}
    </View>
  );
}

/** Tap target for moving an order to another fulfilment state. */
function StatusChip({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useAdmin();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ height: 34, paddingHorizontal: 13, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface3 : c.surface2 })}>
      <T size={12} font="semi" mut>{label}</T>
    </Pressable>
  );
}

/* ── Stock levels ── */
function Inventory() {
  const { c } = useTheme();
  const q = useAsync(() => safe(merchApi.inventory({ limit: 200 }), [] as any), []);
  const rows = toRows(q.data);

  if (q.loading) return <ALoading />;
  if (!rows.length) return <AEmpty icon={<Boxes size={26} color={c.fgMuted} />} title="No stock records" />;

  const low = rows.filter((r: any) => Number(r.stock ?? r.quantity ?? 0) <= Number(r.low_stock_threshold ?? 5));

  return (
    <>
      <AGrid>
        <AStatTile label="Tracked items" value={rows.length} Icon={Boxes} />
        <AStatTile label="Low on stock" value={low.length} Icon={Package} tone={low.length ? c.danger : c.success} />
      </AGrid>

      <View style={{ gap: 12 }}>
        {rows.map((r: any, i: number) => {
          const qty = Number(r.stock ?? r.quantity ?? 0);
          const isLow = qty <= Number(r.low_stock_threshold ?? 5);
          return (
            <ARecord
              key={r._id || i}
              title={r.product_name || r.name || r.sku || "Item"}
              subtitle={r.sku}
              right={<ATag label={isLow ? "Low" : "OK"} tone={isLow ? "danger" : "success"} />}
              meta={[{ label: "In stock", value: String(qty) }]}
            />
          );
        })}
      </View>
    </>
  );
}

/* ── Store analytics ── */
function Insights() {
  const { c } = useTheme();
  const q = useAsync(() => safe(merchApi.analytics(), null as any), []);
  const an = q.data || {};

  const top: { label: string; value: number }[] = (() => {
    const src = an.top_products || an.best_sellers || an.by_product;
    if (Array.isArray(src)) return src.map((x: any) => ({ label: x.name || x.product_name || "—", value: Number(x.quantity ?? x.count ?? x.total ?? 0) }));
    if (src && typeof src === "object") return Object.entries(src).map(([k, v]) => ({ label: k, value: Number(v) || 0 }));
    return [];
  })();

  if (q.loading) return <ALoading rows={2} />;

  return (
    <>
      <AGrid>
        <AStatTile label="Orders" value={Number(an.total_orders ?? 0)} Icon={ShoppingBag} />
        <AStatTile label="Revenue" value={formatINR(an.total_revenue ?? an.revenue ?? 0)} Icon={IndianRupee} tone={c.success} />
        <AStatTile label="Items sold" value={Number(an.items_sold ?? an.total_items ?? 0)} Icon={Package} />
        <AStatTile label="Avg order" value={formatINR(an.average_order_value ?? an.avg_order ?? 0)} Icon={TrendingUp} />
      </AGrid>
      {top.length ? <APanel title="Best sellers"><AHatchBars data={top} /></APanel> : null}
    </>
  );
}
