import { runChecks } from "./checks";
import type { Finding, Index, Line, Packet } from "./types";

export async function loadPacket(): Promise<Packet> {
  const res = await fetch("/packet.json");
  if (!res.ok) throw new Error("Could not load packet.json");
  return res.json();
}

export function buildIndex(packet: Packet, versionId?: string): Index {
  const current =
    packet.return_versions.find((v) => v.version === versionId) ||
    packet.return_versions[packet.return_versions.length - 1];
  const docs = new Map(packet.documents.map((d) => [d.id, d]));
  const ev = new Map(packet.extracted_values.map((e) => [e.id, e]));
  const evByDoc = new Map<string, typeof packet.extracted_values>();
  for (const e of packet.extracted_values) {
    const arr = evByDoc.get(e.document_id) || [];
    arr.push(e);
    evByDoc.set(e.document_id, arr);
  }
  const versions = new Map(packet.return_versions.map((v) => [v.version, v]));
  const lines = new Map(current.lines.map((l) => [l.key, l]));
  const linesByForm = new Map<string, Line[]>();
  for (const l of current.lines) {
    const arr = linesByForm.get(l.form) || [];
    arr.push(l);
    linesByForm.set(l.form, arr);
  }
  const landings = new Map<string, Line[]>();
  const docToLines = new Map<string, Line[]>();
  for (const l of current.lines) {
    for (const s of l.sources || []) {
      const arr = landings.get(s) || [];
      arr.push(l);
      landings.set(s, arr);
      const e = ev.get(s);
      if (e) {
        const darr = docToLines.get(e.document_id) || [];
        if (!darr.includes(l)) darr.push(l);
        docToLines.set(e.document_id, darr);
      }
      if (s.startsWith("D") && docs.has(s)) {
        const darr = docToLines.get(s) || [];
        if (!darr.includes(l)) darr.push(l);
        docToLines.set(s, darr);
      }
    }
  }
  const prior = new Map(
    Object.entries(packet.prior_years.return_2024?.lines || {})
  );
  const findings = runChecks(packet, current);
  return {
    packet,
    docs,
    ev,
    evByDoc,
    versions,
    current,
    lines,
    linesByForm,
    landings,
    docToLines,
    prior,
    findings,
  };
}

export function construction(
  idx: Index,
  key: string,
  seen = new Set<string>()
): { key: string; line: Line; children: ReturnType<typeof construction>[] } | null {
  if (seen.has(key)) return null;
  seen.add(key);
  const line = idx.lines.get(key);
  if (!line) return null;
  return {
    key,
    line,
    children: (line.inputs || [])
      .map((k) => construction(idx, k, seen))
      .filter(Boolean) as ReturnType<typeof construction>[],
  };
}

export function visibleDocs(idx: Index, clock: string) {
  return idx.packet.documents.filter((d) => d.received_at <= clock);
}

export function versionAt(idx: Index, clock: string) {
  const vs = [...idx.packet.return_versions].sort((a, b) =>
    a.computed_at.localeCompare(b.computed_at)
  );
  let cur = vs[0];
  for (const v of vs) if (v.computed_at <= clock) cur = v;
  return cur;
}

// An investigation may only cite evidence that has arrived by the chosen season date.
// This is a visibility guard for the replay demo, not a complete historical recomputation.
export function findingVisible(idx: Index, f: Finding, clock: string): boolean {
  const docs = idx.docs;
  const availableDocument = (id: string) => {
    const d = docs.get(id);
    return !!d && d.received_at <= clock;
  };
  return f.refs.every((ref) => {
    if (/^D\d+(?:#.*)?$/.test(ref)) return availableDocument(ref.split("#")[0]);
    if (/^doc:D\d+#page\d+$/.test(ref)) return availableDocument(ref.slice(4).split("#")[0]);
    if (ref.startsWith("ev-")) {
      const e = idx.ev.get(ref);
      return !!e && availableDocument(e.document_id);
    }
    if (ref.startsWith("msg-")) {
      const m = idx.packet.client.messages.find((x) => x.id === ref);
      return !!m && m.sent_at <= clock;
    }
    if (ref.startsWith("qa-")) {
      const q = idx.packet.client.questionnaire.find((x) => x.id === ref);
      return !!q && q.answered_at <= clock;
    }
    return true;
  });
}
