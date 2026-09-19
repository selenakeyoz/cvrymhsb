import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import {
  ROLES,
  ROLE_LABELS,
  listStaff,
  createStaff,
  deleteStaff,
  listAllowedIps,
  addAllowedIp,
  removeAllowedIp,
  type Role,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/yonetim")({
  head: () => ({
    meta: [
      { title: "Yönetim | Adisyon" },
      { name: "description", content: "Personel hesapları ve izinli ağ (IP) listesi yönetimi." },
      { property: "og:title", content: "Yönetim | Adisyon" },
      { property: "og:description", content: "Kullanıcı ekleyin, erişimi belirlediğiniz ağlara kısıtlayın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const staffFn = useServerFn(listStaff);
  const createFn = useServerFn(createStaff);
  const deleteFn = useServerFn(deleteStaff);
  const ipsFn = useServerFn(listAllowedIps);
  const addIpFn = useServerFn(addAllowedIp);
  const removeIpFn = useServerFn(removeAllowedIp);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("garson");
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const staff = useQuery({ queryKey: ["staff"], queryFn: () => staffFn() });
  const ips = useQuery({ queryKey: ["allowed-ips"], queryFn: () => ipsFn() });

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFn({ data: { username, password, fullName: fullName || undefined, role } });
      toast.success("Personel eklendi.");
      setUsername("");
      setFullName("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Personel eklenemedi.");
    }
  };

  const delStaff = async (userId: string) => {
    try {
      await deleteFn({ data: { userId } });
      toast.success("Personel silindi.");
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi.");
    }
  };

  const addIp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addIpFn({ data: { ip, label: label || undefined } });
      toast.success("Ağ eklendi.");
      setIp("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["allowed-ips"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi.");
    }
  };

  const delIp = async (id: string) => {
    try {
      await removeIpFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["allowed-ips"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="font-display text-3xl">YÖNETİM</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Personel hesapları ve restoran ağına erişim izinleri.
      </p>

      <section className="mb-10">
        <p className="mb-3 text-xs tracking-widest text-muted-foreground">PERSONEL</p>
        <form onSubmit={addStaff} className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-32 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Kullanıcı adı</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="min-w-32 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Ad soyad</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs text-muted-foreground">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </form>

        <ul className="space-y-2">
          {(staff.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
            >
              <span className="font-semibold">{s.username}</span>
              <span className="text-muted-foreground">{s.full_name ?? ""}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {s.roles.map((r) => ROLE_LABELS[r]).join(", ") || "Rol yok"}
              </span>
              <button onClick={() => delStaff(s.id)} className="rounded p-1 hover:bg-accent">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="mb-3 flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
          <Wifi className="h-3.5 w-3.5" /> İZİNLİ AĞLAR (IP)
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Restoranın internet çıkış IP adresini ekleyin; liste boşken erişim herkese açıktır.
          Örnek maske: <code>85.104.12.*</code>
        </p>
        <form onSubmit={addIp} className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-40 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">IP adresi</label>
            <input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="min-w-32 flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Etiket</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Restoran wifi"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Ekle
          </button>
        </form>
        <ul className="space-y-2">
          {(ips.data ?? []).map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm"
            >
              <span className="font-mono">{row.ip}</span>
              <span className="text-muted-foreground">{row.label ?? ""}</span>
              <button onClick={() => delIp(row.id)} className="ml-auto rounded p-1 hover:bg-accent">
                <Trash2 className="h-4 w-4 text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
