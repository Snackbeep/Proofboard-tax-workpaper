
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { uid } from "./format";
import { buildIndex, findingVisible, loadPacket } from "./packet";
import type {
  Adjustment,
  AreaId,
  FiledSnapshot,
  Index,
  Packet,
  RoleId,
  WorkState,
} from "./types";

const KEY = "proofboard-okafor-2025";
const DEFAULT_CLOCK = "2026-06-24T12:00:00.000Z";

const initialWork = (): WorkState => ({
  roleId: "st-01",
  clock: DEFAULT_CLOCK,
  lastSeen: {},
  adjustments: [],
  verifications: [],
  reviewNotes: [],
  questions: [],
  signoffs: [],
  judgments: [],
  timeEntries: [
    {
      id: uid(),
      who: "st-01",
      area: "intake_and_engagement",
      hours: 1.2,
      at: "2026-03-09T15:00:00Z",
      note: "Opened file, identity, organizer",
    },
    {
      id: uid(),
      who: "st-01",
      area: "wages_and_stock_compensation",
      hours: 2.1,
      at: "2026-03-12T16:00:00Z",
      note: "W-2s and stock plan",
    },
  ],
  viewLogs: [],
  attachments: [],
  dispositions: {
    D30: {
      status: "superseded",
      why: "Replaced by corrected Meridian 1099 (D31).",
    },
    D10: {
      status: "duplicate",
      why: "Phone photo of Halvorsen W-2 already on D09; wages counted once.",
    },
  },
  resolvedFindings: {},
  selectedWhatIf: null,
  frozenAt: null,
  filedSnapshots: [],
  amendMode: false,
  clientApproval: {},
  standards: [],
  assignments: {
    preparer: "st-01",
    reviewer: "st-02",
    partner: "st-03",
  },
  notifications: [
    {
      id: uid(),
      at: "2026-06-23T06:10:00Z",
      text: "Engine recomputed v3 after Ridgeline K-1.",
      read: false,
    },
  ],
  undo: [],
});

function loadSavedWork(): WorkState {
  const initial = initialWork();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;

    const saved = JSON.parse(raw) as Partial<WorkState>;
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return initial;
    }

    const sanitizeApproval = (
      approval?: { at: string; pin: string }
    ) =>
      approval
        ? {
            at: approval.at,
            pin:
              approval.pin === "not-stored"
                ? "not-stored"
                : "legacy-invalid",
          }
        : undefined;

    return {
      ...initial,
      ...saved,
      filedSnapshots: Array.isArray(saved.filedSnapshots) ? saved.filedSnapshots : [],
      clientApproval: {
        ngozi: sanitizeApproval(saved.clientApproval?.ngozi),
        erik: sanitizeApproval(saved.clientApproval?.erik),
      },
    };
  } catch {
    return initial;
  }
}

// The snapshot is assembled from the engine output plus the adjustments
// visible when filing. It is copied into localStorage with the work state.
export function createFiledSnapshot(
  state: WorkState,
  idx: Index,
  at: string,
  origin: FiledSnapshot["origin"] = "recorded"
): FiledSnapshot {
  const beforeFiling = state.adjustments.filter((a) => a.at <= at);
  const lineValues: Record<string, unknown> = Object.fromEntries(
    idx.current.lines.map((line) => [line.key, line.value])
  );
  for (const adjustment of beforeFiling) {
    lineValues[adjustment.claimKey] = adjustment.to;
  }

  return {
    id: uid(),
    filedAt: at,
    kind: state.filedSnapshots.length ? "amended" : "original",
    origin,
    recordedBy: state.roleId,
    seasonClock: state.clock,
    engineVersion: idx.current.version,
    engineComputedAt: idx.current.computed_at,
    lineValues,
    summary: structuredClone(idx.current.summary),
    evidenceDocumentIds: [...idx.current.documents_used],
    adjustments: structuredClone(beforeFiling),
    verifications: structuredClone(state.verifications),
    signoffs: structuredClone(state.signoffs),
    resolvedFindings: structuredClone(state.resolvedFindings),
    approvalTimes: {
      ngozi: state.clientApproval.ngozi?.pin === "not-stored"
        ? state.clientApproval.ngozi.at : undefined,
      erik: state.clientApproval.erik?.pin === "not-stored"
        ? state.clientApproval.erik.at : undefined,
    },
  };
}

export function canSignLevel(
  state: WorkState,
  level: "preparer" | "reviewer" | "partner" | "client",
  actor: string
): boolean {
  if (level === "client" || !actor || actor !== state.roleId) {
    return false;
  }

  if (state.assignments[level] !== actor) {
    return false;
  }

  if (
    level === "reviewer" &&
    actor === state.assignments.preparer
  ) {
    return false;
  }

  if (
    level === "partner" &&
    (
      actor === state.assignments.preparer ||
      actor === state.assignments.reviewer
    )
  ) {
    return false;
  }

  return true;
}

type Action =
  | { type: "hydrate"; state: WorkState }
  | { type: "role"; roleId: RoleId }
  | { type: "clock"; clock: string }
  | { type: "adjust"; adj: Adjustment }
  | { type: "undo" }
  | {
      type: "verify";
      claimKey: string;
      vtype: string;
      who: string;
      note: string;
    }
  | {
      type: "note";
      area: AreaId | "return";
      text: string;
      who: string;
      blocking: boolean;
    }
  | { type: "resolveNote"; id: string; who: string }
  | { type: "question"; q: WorkState["questions"][number] }
  | {
      type: "answerQ";
      id: string;
      answer: string;
      who: string;
    }
  | { type: "sign"; s: WorkState["signoffs"][number] }
  | {
      type: "reopen";
      area: AreaId | "return";
      reason: string;
    }
  | { type: "judgment"; j: WorkState["judgments"][number] }
  | { type: "time"; e: WorkState["timeEntries"][number] }
  | { type: "view"; who: string; what: string }
  | { type: "attach"; a: WorkState["attachments"][number] }
  | {
      type: "dispose";
      id: string;
      status: string;
      why: string;
    }
  | {
      type: "resolveFinding";
      id: string;
      who: string;
      how: string;
    }
  | { type: "whatIf"; id: string | null }
  | { type: "freeze"; at: string; snapshot: FiledSnapshot }
  | { type: "recoverLegacySnapshot"; snapshot: FiledSnapshot }
  | { type: "amend"; on: boolean }
  | {
      type: "approve";
      who: "ngozi" | "erik";
      pin: string;
    }
  | { type: "standards"; rules: string[] }
  | { type: "assign"; key: string; value: string }
  | { type: "seen"; who: string }
  | { type: "notifyRead"; id: string }
  | { type: "reset" };

function reducer(
  state: WorkState,
  action: Action
): WorkState {
  switch (action.type) {
    case "hydrate":
      return {
        ...initialWork(),
        ...action.state,
        filedSnapshots: action.state.filedSnapshots ?? [],
      };

    case "role":
      return {
        ...state,
        roleId: action.roleId,
      };

    case "clock":
      return {
        ...state,
        clock: action.clock,
      };

    case "adjust": {
      if (state.frozenAt && !state.amendMode) {
        return state;
      }

      return {
        ...state,
        adjustments: [...state.adjustments, action.adj],
        undo: [...state.undo, action.adj],
        signoffs: state.signoffs.map((s) =>
          s.open
            ? s
            : {
                ...s,
                open: true,
                reopenReason:
                  `Value ${action.adj.claimKey} changed`,
              }
        ),
        notifications: [
          {
            id: uid(),
            at: action.adj.at,
            text:
              `${action.adj.claimKey} adjusted ` +
              `(${action.adj.why})`,
            read: false,
          },
          ...state.notifications,
        ],
      };
    }

    case "undo": {
      if (state.frozenAt && !state.amendMode) return state;
      const last = state.undo[state.undo.length - 1];
      if (!last || (state.frozenAt && last.at <= state.frozenAt)) return state;

      return {
        ...state,
        adjustments: state.adjustments.filter(
          (a) => a.id !== last.id
        ),
        undo: state.undo.slice(0, -1),
      };
    }

    case "verify":
      return {
        ...state,
        verifications: [
          ...state.verifications,
          {
            id: uid(),
            claimKey: action.claimKey,
            type: action.vtype,
            who: action.who,
            at: new Date().toISOString(),
            note: action.note,
          },
        ],
      };

    case "note":
      return {
        ...state,
        reviewNotes: [
          ...state.reviewNotes,
          {
            id: uid(),
            area: action.area,
            text: action.text,
            who: action.who,
            at: new Date().toISOString(),
            blocking: action.blocking,
            resolved: false,
          },
        ],
      };

    case "resolveNote":
      return {
        ...state,
        reviewNotes: state.reviewNotes.map((n) =>
          n.id === action.id
            ? {
                ...n,
                resolved: true,
                resolvedBy: action.who,
                resolvedAt: new Date().toISOString(),
              }
            : n
        ),
      };

    case "question":
      return {
        ...state,
        questions: [...state.questions, action.q],
      };

    case "answerQ":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id
            ? {
                ...q,
                answer: action.answer,
                answeredAt: new Date().toISOString(),
                answeredBy: action.who,
                evidence: true,
              }
            : q
        ),
      };

    case "sign": {
      if (!canSignLevel(state, action.s.level, action.s.who)) {
        return state;
      }

      return {
        ...state,
        signoffs: [
          ...state.signoffs.filter(
            (s) =>
              !(
                s.area === action.s.area &&
                s.level === action.s.level &&
                !s.open
              )
          ),
          action.s,
        ],
      };
    }

    case "reopen":
      return {
        ...state,
        signoffs: state.signoffs.map((s) =>
          s.area === action.area && !s.open
            ? {
                ...s,
                open: true,
                reopenReason: action.reason,
              }
            : s
        ),
      };

    case "judgment":
      return {
        ...state,
        judgments: [...state.judgments, action.j],
      };

    case "time":
      return {
        ...state,
        timeEntries: [...state.timeEntries, action.e],
      };

    case "view":
      return {
        ...state,
        viewLogs: [
          {
            at: new Date().toISOString(),
            who: action.who,
            what: action.what,
          },
          ...state.viewLogs,
        ].slice(0, 400),
      };

    case "attach":
      return {
        ...state,
        attachments: [...state.attachments, action.a],
      };

    case "dispose":
      return {
        ...state,
        dispositions: {
          ...state.dispositions,
          [action.id]: {
            status: action.status,
            why: action.why,
          },
        },
      };

    case "resolveFinding":
      return {
        ...state,
        resolvedFindings: {
          ...state.resolvedFindings,
          [action.id]: {
            who: action.who,
            at: new Date().toISOString(),
            how: action.how,
          },
        },
      };

    case "whatIf":
      return {
        ...state,
        selectedWhatIf: action.id,
      };

    case "freeze":
      // Do not overwrite an existing filing except through amendment mode.
      if (state.frozenAt && !state.amendMode) return state;
      return {
        ...state,
        frozenAt: action.at,
        amendMode: false,
        filedSnapshots: [...state.filedSnapshots, structuredClone(action.snapshot)],
      };

    case "recoverLegacySnapshot":
      if (!state.frozenAt || state.filedSnapshots.length > 0) return state;
      return {
        ...state,
        filedSnapshots: [structuredClone(action.snapshot)],
      };

    case "amend":
      if (action.on && !state.frozenAt) return state;
      return {
        ...state,
        amendMode: action.on,
      };

    case "approve": {
      const expectedClientRole =
        action.who === "ngozi" ? "cu-01" : "cu-02";

      if (state.roleId !== expectedClientRole) {
        return state;
      }

      if (
        state.clientApproval[action.who]?.pin === "not-stored"
      ) {
        return state;
      }

      return {
        ...state,
        clientApproval: {
          ...state.clientApproval,
          [action.who]: {
            at: new Date().toISOString(),
            pin: "not-stored",
          },
        },
      };
    }

    case "standards":
      return {
        ...state,
        standards: action.rules,
      };

    case "assign":
      return {
        ...state,
        assignments: {
          ...state.assignments,
          [action.key]: action.value,
        },
      };

    case "seen":
      return {
        ...state,
        lastSeen: {
          ...state.lastSeen,
          [action.who]: new Date().toISOString(),
        },
      };

    case "notifyRead":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id
            ? { ...n, read: true }
            : n
        ),
      };

    case "reset":
      return initialWork();

    default:
      return state;
  }
}

type Ctx = {
  packet: Packet | null;
  idx: Index | null;
  work: WorkState;
  dispatch: React.Dispatch<Action>;
  displayValue: (key: string) => unknown;
  taxEffect: (
    key: string,
    delta: number
  ) => {
    fed: number;
    ca: number;
  };
  blocking: boolean;
  error: string | null;
};

const C = createContext<Ctx | null>(null);

export function Provider({
  children,
}: {
  children: ReactNode;
}) {
  const [work, dispatch] = useReducer(
    reducer,
    undefined,
    loadSavedWork
  );

  const [packet, setPacket] = useReducer(
    (_: Packet | null, p: Packet | null) => p,
    null
  );

  const [error, setError] = useReducer(
    (_: string | null, e: string | null) => e,
    null
  );

  useEffect(() => {
    loadPacket()
      .then((p) => setPacket(p))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    localStorage.setItem(
      KEY,
      JSON.stringify(work)
    );
  }, [work]);

  const idx = useMemo(
    () => (packet ? buildIndex(packet) : null),
    [packet]
  );

  // Older versions saved the filing timestamp but no snapshot. Build a
  // clearly-labelled reconstruction using adjustments dated before filing.
  // This cannot prove exactly what was filed; future freezes are captured live.
  useEffect(() => {
    if (!idx || !work.frozenAt || work.filedSnapshots.length) return;
    dispatch({
      type: "recoverLegacySnapshot",
      snapshot: createFiledSnapshot(work, idx, work.frozenAt, "legacy-reconstructed"),
    });
  }, [idx, work.frozenAt, work.filedSnapshots.length]);

  const displayValue = (key: string) => {
    const adjs = work.adjustments.filter(
      (a) => a.claimKey === key
    );

    if (adjs.length) {
      return adjs[adjs.length - 1].to;
    }

    return idx?.lines.get(key)?.value;
  };

  const taxEffect = (key: string, delta: number) => {
    const rates = idx?.current.tax_effect_rates || {};
    let cat = "ordinary_income";

    if (
      key.startsWith("F1040.1") ||
      /wage/i.test(key)
    ) {
      cat = "wages";
    } else if (/SchC/.test(key)) {
      cat = "schc_profit";
    } else if (/8949|SchD|ltcg|long/i.test(key)) {
      cat = "ltcg";
    } else if (/stcg|short/i.test(key)) {
      cat = "stcg";
    } else if (
      /interest|SchB|F1040.2/.test(key)
    ) {
      cat = "interest";
    } else if (/SchA/.test(key)) {
      cat = "itemized";
    } else if (/adjust|F1040.10/.test(key)) {
      cat = "adjustment";
    }

    const r = rates[cat] || rates.ordinary_income;

    return {
      fed: delta * (r?.federal_per_dollar || 0),
      ca: delta * (r?.california_per_dollar || 0),
    };
  };

  const blocking =
    work.reviewNotes.some(
      (n) => n.blocking && !n.resolved
    ) ||
    (idx?.findings.some(
      (f) =>
        f.severity === "block" &&
        findingVisible(idx, f, work.clock) &&
        !work.resolvedFindings[f.id]
    ) ?? false);

  const value: Ctx = {
    packet,
    idx,
    work,
    dispatch,
    displayValue,
    taxEffect,
    blocking,
    error,
  };

  return (
    <C.Provider value={value}>
      {children}
    </C.Provider>
  );
}

export function useWP() {
  const ctx = useContext(C);

  if (!ctx) {
    throw new Error("useWP outside Provider");
  }

  return ctx;
}
