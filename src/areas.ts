import type { AreaId, Line } from "./types";

export const AREAS: {
  id: AreaId;
  title: string;
  blurb: string;
  forms: string[];
  budgetKey?: string;
}[] = [
  {
    id: "identity",
    title: "People & identity",
    blurb: "Who files, who is claimed, IP PIN, IDs, related returns.",
    forms: [],
    budgetKey: "intake_and_engagement",
  },
  {
    id: "wages",
    title: "Wages & stock",
    blurb: "W-2s, RSUs, ISO, ESPP, California withholding after the move.",
    forms: ["F1040", "F6251", "F8959"],
    budgetKey: "wages_and_stock_compensation",
  },
  {
    id: "business",
    title: "Lindqvist Studio",
    blurb: "Books to tax, equipment, mileage, home office, contractors.",
    forms: ["SchC", "SchSE", "F4562-C", "F8995"],
    budgetKey: "business",
  },
  {
    id: "investments",
    title: "Brokerage sales",
    blurb: "Hundreds of lots, summaries vs detail, corrected 1099s.",
    forms: ["F8949", "SchD", "SchB"],
    budgetKey: "investments_and_digital_assets",
  },
  {
    id: "crypto",
    title: "Digital assets",
    blurb: "Coinhaven 1099-DA, missing basis, transfer-ins.",
    forms: ["F8949"],
    budgetKey: "investments_and_digital_assets",
  },
  {
    id: "foreign",
    title: "Foreign account",
    blurb: "Swedish savings, Form 8938, FBAR outside the engagement.",
    forms: ["F8938", "SchB"],
  },
  {
    id: "rentals",
    title: "Rentals & sale",
    blurb: "Sacramento rental, Austin condo sale, passive losses, recapture.",
    forms: ["SchE", "F4797", "F4562-E", "F8582"],
    budgetKey: "rentals_and_sale",
  },
  {
    id: "passthroughs",
    title: "K-1s & basis",
    blurb: "S corp with a missing year, late partnership K-1, Form 7203.",
    forms: ["F7203", "SchE"],
    budgetKey: "pass_throughs_and_basis",
  },
  {
    id: "retirement",
    title: "Retirement & HSA",
    blurb: "Backdoor Roth, Form 8606, SEP, HSA.",
    forms: ["F8606", "F8889"],
  },
  {
    id: "deductions",
    title: "Deductions",
    blurb: "Itemized vs standard, gifts of stock and a car, SALT cap.",
    forms: ["SchA", "F8283"],
    budgetKey: "deductions_and_credits",
  },
  {
    id: "credits",
    title: "Credits & diligence",
    blurb: "CTC/ODC, AOTC phaseout, dependent care, Form 8867.",
    forms: ["F8812", "F8863", "F2441", "F8867"],
    budgetKey: "deductions_and_credits",
  },
  {
    id: "california",
    title: "California split",
    blurb: "Part-year 540NR, source income, residency days, CA vs federal.",
    forms: ["F540NR", "SchCA540NR", "ScheduleS", "FTB3885A", "FTB5805"],
    budgetKey: "california",
  },
  {
    id: "payments",
    title: "Tax, payments, penalty",
    blurb: "Computation, estimates, withholding, 2210, extension.",
    forms: ["F1040", "F2210", "Sch2", "Sch3"],
  },
  {
    id: "completeness",
    title: "Completeness",
    blurb: "Every document, every area, every outside filing.",
    forms: [],
  },
];

export function areaForLine(line: Line): AreaId {
  if (line.form === "SchC" || line.form === "SchSE" || line.form === "F4562-C")
    return "business";
  if (line.form === "F8949") {
    const l = line.label.toLowerCase();
    if (l.includes("coinhaven") || l.includes("btc") || l.includes("eth"))
      return "crypto";
    return "investments";
  }
  if (line.form === "SchD" || line.form === "SchB") return "investments";
  if (line.form === "SchE" || line.form === "F4797" || line.form === "F4562-E" || line.form === "F8582")
    return "rentals";
  if (line.form === "F7203") return "passthroughs";
  if (line.form === "F8606" || line.form === "F8889") return "retirement";
  if (line.form === "SchA" || line.form === "F8283") return "deductions";
  if (["F8812", "F8863", "F2441", "F8867"].includes(line.form)) return "credits";
  if (["F540NR", "SchCA540NR", "ScheduleS", "FTB3885A", "FTB5805"].includes(line.form))
    return "california";
  if (line.form === "F8938") return "foreign";
  if (line.form === "F6251" || line.key.startsWith("F1040.1")) return "wages";
  if (line.form === "F8995") return "business";
  return "payments";
}

export const headlineKeys = [
  "F1040.1a",
  "F1040.7",
  "F1040.11",
  "F1040.15",
  "F1040.24",
  "F1040.33",
  "F1040.37",
  "F540NR.64",
  "F540NR.97",
];
