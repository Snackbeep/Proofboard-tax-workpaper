import type { RoleId, Staff } from "./types";

export const money = (n: unknown, cents = false) => {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return String(n);
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: cents || (abs > 0 && abs < 1) ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return v < 0 ? `(${formatted})` : formatted;
};

export const moneySigned = (n: number) => {
  const s = money(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
};

export const dt = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const day = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function maskValue(
  value: unknown,
  kind: string,
  clearance: boolean
): string {
  const s = value == null ? "" : String(value);
  if (clearance) return s;
  if (kind === "ssn" || /ssn|social/i.test(kind)) {
    const digits = s.replace(/\D/g, "");
    return digits.length >= 4 ? `•••-••-${digits.slice(-4)}` : "•••-••-••••";
  }
  if (kind === "account_number" || /account|routing|bank/i.test(kind)) {
    return s.length > 4 ? `••••${s.slice(-4)}` : "••••";
  }
  if (kind === "ip_pin" || /ip.?pin/i.test(kind)) return "••••••";
  return s;
}

export const roleLabel = (staff: Staff | undefined, id: string) => {
  if (!staff) {
    if (id === "cu-01") return "Ngozi Okafor · client";
    if (id === "cu-02") return "Erik Lindqvist · client";
    if (id === "irs-exam") return "IRS examiner (2028)";
    return id;
  }
  const cred = staff.credential ? `, ${staff.credential}` : "";
  return `${staff.name} · ${staff.role.replaceAll("_", " ")}${cred}`;
};

export const isClient = (id: RoleId) => id === "cu-01" || id === "cu-02";
export const isExam = (id: RoleId) => id === "irs-exam";

export function snapshotOf(
  values: Record<string, unknown>,
  keys: string[]
): string {
  return keys.map((k) => `${k}=${JSON.stringify(values[k])}`).join("|");
}

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v)))
    return Number(v);
  return null;
}
