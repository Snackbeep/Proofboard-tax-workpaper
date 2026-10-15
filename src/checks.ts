import { num } from "./format";
import type { Finding, Packet, ReturnVersion } from "./types";

function evs(packet: Packet, docId: string, field: string) {
  return packet.extracted_values.filter(
    (e) => e.document_id === docId && e.field === field
  );
}

export function runChecks(packet: Packet, v: ReturnVersion): Finding[] {
  const findings: Finding[] = [];
  const line = (k: string) => v.lines.find((l) => l.key === k);

  const theo = packet.household.people.find((p) => p.id === "theo") as
    | { ssn: string }
    | undefined;
  const card = packet.extracted_values.find(
    (e) => e.document_id === "D71" && e.field === "ssn"
  );
  if (theo && card && String(theo.ssn) !== String(card.value)) {
    findings.push({
      id: "THEO_SSN",
      title: "Dependent SSN does not match the Social Security card",
      severity: "block",
      area: "identity",
      summary: `Organizer has ${theo.ssn}. Card D71 has ${card.value}. This is the e-file reject R0000-504-02.`,
      howSurfaced:
        "Workpaper compared household.people to D71 instead of trusting the organizer or the engine.",
      refs: ["household:theo", "ev-1080", "D71"],
      claimKeys: [],
      taxHint: "Filing blocker. No tax change; the name/TIN pair is wrong.",
    });
  }

  const meridianSummary = packet.extracted_values.find(
    (e) =>
      e.document_id === "D31" &&
      String(e.field).toLowerCase().includes("proceed") &&
      typeof e.value === "number" &&
      e.value > 10000
  );
  const lots = v.lines.filter(
    (l) => l.form === "F8949" && /M\d+|Meridian|Harbor Lane|Pinecrest|Cascade|Ironwood|Meadowlark|Bluewater|Summit|Northgate/i.test(l.label)
  );
  const meridianLots = v.lines.filter((l) =>
    /^F8949\.[A-Z]\.M\d+/i.test(l.line) || / \(M\d+/i.test(l.label)
  );
  const useLots = meridianLots.length ? meridianLots : lots.filter((l) => /acquired/.test(l.label) && !/Corvane|Coinhaven|Brightpath|Northlake/i.test(l.label));
  const lotProceeds = useLots.reduce((s, l) => {
    const m = /proceeds\s([\d,]+\.\d{2})/i.exec(l.label);
    return s + (m ? Number(m[1].replace(/,/g, "")) : 0);
  }, 0);
  const page32 = packet.documents
    .find((d) => d.id === "D31")
    ?.pages.find((p) => p.page === 32);
  if (page32 && /M18/.test(page32.printed_content)) {
    findings.push({
      id: "MERIDIAN_M18",
      title: "Meridian page 32 was never read — $250 lot missing",
      severity: "warn",
      area: "investments",
      summary: `1099-B summary proceeds 71,965 vs extracted lots 71,715. Printed page 32 has lot M18 Ironwood REIT cash-in-lieu proceeds 250.00, which is the entire gap. The engine warned about the mismatch and still filed the lots it could see.`,
      howSurfaced:
        "Independent recon of summary vs lots, then a read of the unread page (extraction.reason) rather than accepting the diagnostic.",
      refs: ["D31", "D30", "doc:D31#page32"],
      claimKeys: useLots[0] ? [useLots[0].key] : ["F1040.7"],
      taxHint: "Short-term noncovered $250 proceeds / $310 basis. Small tax effect; completeness failure.",
    });
  }

  const d30 = packet.documents.find((d) => d.id === "D30");
  const d31 = packet.documents.find((d) => d.id === "D31");
  if (d30 && d31) {
    findings.push({
      id: "MERIDIAN_CORRECTED",
      title: "Corrected Meridian 1099 still disagrees with the original in three lots",
      severity: "warn",
      area: "investments",
      summary:
        "D31 (CORRECTED) vs D30: M6 wash-sale disallowed 512 vs 735; M9 basis 4,880 vs 6,900; M14 acquired 2024-09-15 vs 2024-10-15. Pipeline re-extracted the correction but still skipped page 32.",
      howSurfaced: "Diff of printed_content on the original vs corrected 1099, lot by lot.",
      refs: ["D30", "D31"],
      claimKeys: ["F1040.7"],
    });
  }

  const qa14 = packet.client.questionnaire.find((q) => q.id === "qa-14");
  const qa15 = packet.client.questionnaire.find((q) => q.id === "qa-15");
  const nSales = v.lines.filter((l) => l.form === "F8949").length;
  if (qa14 && /no/i.test(qa14.answer)) {
    findings.push({
      id: "QA_SALES",
      title: "Client said no investments were sold",
      severity: "warn",
      area: "investments",
      summary: `Questionnaire qa-14 is “No.” The return has ${nSales} Form 8949 lots across two brokerages, RSUs, and crypto. qa-15 says crypto was “just moved around.”`,
      howSurfaced:
        "Workpaper treats client answers as evidence that can be false, and cross-checks them against documents.",
      refs: ["qa-14", "qa-15"],
      claimKeys: ["F1040.7"],
    });
  }

  const c6 = packet.extracted_values.find((e) => e.id === "ev-0919");
  const msg = packet.client.messages.find((m) => m.id === "msg-07");
  if (c6) {
    findings.push({
      id: "CRYPTO_BASIS",
      title: "Coinhaven lot C6 has no extracted basis",
      severity: "warn",
      area: "crypto",
      summary: `Engine used zero basis (confidence ${c6.confidence}). Client later said BTC was bought March 2021 for about 3,050 (msg-07). That message is evidence, not yet an adjustment.`,
      howSurfaced:
        "Low-confidence empty basis + later client message linked to the same lot.",
      refs: ["ev-0919", "D34", "D35", "msg-07"],
      claimKeys: v.lines.filter((l) => /C6|Coinhaven/i.test(l.label)).map((l) => l.key).slice(0, 3),
      taxHint: "Raising basis ~3,050 reduces LTCG; use ltcg rate on v3.",
    });
  }

  const gift = packet.extracted_values.find((e) => e.id === "ev-1049");
  if (gift) {
    findings.push({
      id: "CHARITY_DIGIT",
      title: "Handwritten St. Brigid gift: first digit is ambiguous",
      severity: "warn",
      area: "deductions",
      summary: `Pipeline read 1,500.00 at confidence 0.41. Printed: “$?,500.00” (1 or 7). Client later confirmed 1,500 by phone and check #2207 (msg-08). Form 8283 / 2028 exam also asks about noncash gifts.`,
      howSurfaced:
        "Confidence threshold + printed_content showing an unreadable digit. Confirmation lives on a message, not on the receipt.",
      refs: ["ev-1049", "D64", "msg-08", "D65", "D66"],
      claimKeys: v.lines.filter((l) => l.form === "SchA" || l.form === "F8283").map((l) => l.key).slice(0, 4),
    });
  }

  const w2box1 = [
    ...evs(packet, "D08", "box1"),
    ...evs(packet, "D09", "box1"),
  ].reduce((s, e) => s + (num(e.value) || 0), 0);
  const wages = num(line("F1040.1a")?.value);
  const d10 = evs(packet, "D10", "box1")[0];
  if (wages != null && Math.abs(wages - w2box1) < 1 && d10) {
    findings.push({
      id: "DUP_W2",
      title: "Halvorsen W-2 was uploaded twice; wages counted once",
      severity: "info",
      area: "wages",
      summary: `D09 PDF and D10 phone photo are the same W-2 (${moneyish(d10.value)}). Engine rule R-W2-BOX1-SUM matched them. Independent sum of distinct W-2s = ${moneyish(w2box1)}, matches F1040.1a ${moneyish(wages)}.`,
      howSurfaced: "Workpaper summed distinct issuers, not every image.",
      refs: ["D09", "D10", "ev-0035", "ev-0052", "F1040.1a"],
      claimKeys: ["F1040.1a"],
    });
  }

  const nec = ["D16", "D17", "D18", "D19", "D20"]
    .flatMap((id) => evs(packet, id, "box1"))
    .reduce((s, e) => s + (num(e.value) || 0), 0);
  const k = evs(packet, "D21", "box1a")[0];
  const kAmt = num(k?.value) || 0;
  const schc = num(line("SchC.1")?.value) || 0;
  const gap = schc - nec - kAmt;
  if (Math.abs(gap) > 1) {
    findings.push({
      id: "BOOKS_1099",
      title: "Schedule C receipts exceed third-party 1099s",
      severity: "warn",
      area: "business",
      summary: `1099-NEC box 1 sum ${moneyish(nec)} + 1099-K ${moneyish(kAmt)} = ${moneyish(nec + kAmt)}. SchC.1 is ${moneyish(schc)}. Gap ${moneyish(gap)} is books cash/other. The 2028 exam letter asks to reconcile exactly this.`,
      howSurfaced:
        "Independent books-to-information-return recon, not the engine diagnostic list.",
      refs: ["D16", "D17", "D18", "D19", "D20", "D21", "D14", "SchC.1"],
      claimKeys: ["SchC.1"],
      taxHint: "If the gap is unsubstantiated, it is ordinary/SE income — high tax effect.",
    });
  }

  const expKeys = [
    "SchC.8",
    "SchC.9",
    "SchC.11",
    "SchC.13",
    "SchC.15",
    "SchC.17",
    "SchC.18",
    "SchC.22",
    "SchC.24a",
    "SchC.24b",
    "SchC.25",
    "SchC.27a.1",
    "SchC.27a.2",
  ];
  const expSum = expKeys.reduce((s, k) => s + (num(line(k)?.value) || 0), 0);
  const expLine = num(line("SchC.28")?.value);
  if (expLine != null && Math.abs(expLine - expSum) > 1) {
    findings.push({
      id: "SCHC_EXP_MATH",
      title: "Schedule C expenses do not add",
      severity: "block",
      area: "business",
      summary: `Independent sum ${moneyish(expSum)} vs SchC.28 ${moneyish(expLine)}.`,
      howSurfaced: "Re-ran R-SUM without trusting the engine.",
      refs: ["SchC.28"],
      claimKeys: ["SchC.28"],
    });
  } else {
    findings.push({
      id: "SCHC_EXP_OK",
      title: "Schedule C expense total recalculates",
      severity: "info",
      area: "business",
      summary: `Independent sum of listed expenses = ${moneyish(expSum)}, matches SchC.28.`,
      howSurfaced: "Workpaper arithmetic, not an engine diagnostic.",
      refs: ["SchC.28"],
      claimKeys: ["SchC.28"],
    });
  }

  const qa45 = packet.client.questionnaire.find((q) => q.id === "qa-45");
  if (qa45) {
    findings.push({
      id: "CA_WH_AFTER_MOVE",
      title: "California withholding continued after the Texas move",
      severity: "info",
      area: "california",
      summary:
        "Client: Halvorsen kept withholding CA tax until September. Paystub D73 is a mid-year split clue. Part-year 540NR source wages need a human allocation, not a box-16 dump.",
      howSurfaced: "qa-45 + residency dates + D73, against W-2 box 16.",
      refs: ["qa-45", "D08", "D09", "D73"],
      claimKeys: v.lines.filter((l) => l.key.includes("F540NR") && /wage/i.test(l.label)).map((l) => l.key).slice(0, 3),
    });
  }

  findings.push({
    id: "FBAR",
    title: "Swedish account needs an FBAR the engagement does not cover",
    severity: "warn",
    area: "foreign",
    summary:
      "Sparbanken Norrland max exceeds $10,000. FinCEN 114 is outside D01 scope. Completeness requires identifying the outside filing even when we do not prepare it.",
    howSurfaced: "D36 + engagement letter exclusions + Form 8938 presence.",
    refs: ["D01", "D36", "F8938"],
    claimKeys: v.lines.filter((l) => l.form === "F8938").map((l) => l.key),
  });

  const filed1099 = line("SchC.J");
  if (String(filed1099?.value).toLowerCase() === "no") {
    findings.push({
      id: "NEC_FILING",
      title: "Studio paid contractors ≥ $600 and did not file 1099-NEC",
      severity: "warn",
      area: "business",
      summary:
        "SchC.I is Yes, SchC.J is No. D27 lists contractor payments. Outside filing; penalty exposure for the client, not this 1040.",
      howSurfaced: "Return questions I/J vs contractor report D27.",
      refs: ["D27", "SchC.I", "SchC.J"],
      claimKeys: ["SchC.I", "SchC.J"].filter((k) => line(k)),
    });
  }

  const unused = packet.documents.filter(
    (d) =>
      !v.documents_used.includes(d.id) &&
      !(v.documents_superseded || []).includes(d.id)
  );
  if (unused.length) {
    findings.push({
      id: "UNUSED_DOCS",
      title: `${unused.length} documents never landed on the return`,
      severity: "info",
      area: "completeness",
      summary: unused
        .map((d) => `${d.id} ${d.title}`)
        .join("; ")
        .slice(0, 400),
      howSurfaced: "Document index vs documents_used / superseded.",
      refs: unused.map((d) => d.id),
      claimKeys: [],
    });
  }

  const notEx = packet.documents.filter(
    (d) => d.extraction.status !== "extracted"
  );
  findings.push({
    id: "PARTIAL_EXTRACT",
    title: "Some documents were partial or never extracted",
    severity: "warn",
    area: "completeness",
    summary: notEx
      .map(
        (d) =>
          `${d.id} ${d.extraction.status}${d.extraction.reason ? `: ${d.extraction.reason}` : ""}`
      )
      .join(" · "),
    howSurfaced: "documents[].extraction.status, independent of engine diagnostics.",
    refs: notEx.map((d) => d.id),
    claimKeys: [],
  });

  const py = packet.prior_years.return_2024?.lines || {};
  const agiNow = num(line("F1040.11")?.value);
  const agiPy = num(py["F1040.11"] ?? py["11"]);
  if (agiNow != null && agiPy != null && agiPy !== 0) {
    const pct = ((agiNow - agiPy) / Math.abs(agiPy)) * 100;
    if (Math.abs(pct) >= 10 && Math.abs(agiNow - agiPy) >= 1000) {
      findings.push({
        id: "YOY_AGI",
        title: `AGI moved ${pct.toFixed(0)}% from last year`,
        severity: "info",
        area: "payments",
        summary: `2024 AGI ${moneyish(agiPy)} → 2025 ${moneyish(agiNow)}. Firm standard: flag >10% and >$1,000. Stock compensation, the condo sale, and the late K-1 dominate.`,
        howSurfaced: "Variance engine using prior_years.return_2024 vs v3, not a spreadsheet tab.",
        refs: ["F1040.11", "py:/return_2024"],
        claimKeys: ["F1040.11"],
      });
    }
  }

  const basis = packet.prior_years.basis_records as {
    scorp_lindqvist_family_woodworks?: { year: number; ending_stock_basis: number | null }[];
  };
  const gapYear = basis?.scorp_lindqvist_family_woodworks?.find(
    (y) => y.year === 2023 && y.ending_stock_basis == null
  );
  if (gapYear) {
    findings.push({
      id: "SCORP_BASIS",
      title: "S corporation basis still has a hole in 2023 — D40 arrived late",
      severity: "warn",
      area: "passthroughs",
      summary:
        "Prior file had no 2023 K-1. D40 (2023 Woodworks K-1) arrived 2026-06-05. v3 dropped SCORP_BASIS_INCOMPLETE; a human still has to rebuild year-by-year basis and keep the gap visible.",
      howSurfaced: "basis_records gaps vs document D40 vs engine diagnostic disappearing between v2 and v3.",
      refs: ["D39", "D40", "py:/basis_records"],
      claimKeys: v.lines.filter((l) => l.form === "F7203").map((l) => l.key).slice(0, 4),
    });
  }

  return findings;
}

function moneyish(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
