import { useEffect, useMemo, useState } from "react";
import { AREAS, areaForLine, headlineKeys } from "./areas";
import { day, dt, isClient, isExam, maskValue, money, moneySigned, num, roleLabel, uid } from "./format";
import { construction, findingVisible, versionAt, visibleDocs } from "./packet";
import { canSignLevel, createFiledSnapshot, useWP } from "./store";
import type { AreaId, Extracted, Line, RoleId, View } from "./types";

export function App() {
  const { packet, idx, work, dispatch, error, blocking } = useWP();
  const [view, setView] = useState<View>("now");
  const [area, setArea] = useState<AreaId>("investments");
  const [claim, setClaim] = useState<string | null>("F1040.11");
  const [docId, setDocId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (work.roleId) dispatch({ type: "seen", who: work.roleId });
  }, [work.roleId]);

  if (error) return <div className="pad">Failed to load packet: {error}</div>;
  if (!packet || !idx) return <div className="pad">Loading the household packet…</div>;

  const staff = packet.firm.staff.find((s) => s.id === work.roleId);
  const clearance = staff?.sensitive_data_clearance ?? isExam(work.roleId);
  const actors: { id: RoleId; label: string }[] = [
    ...packet.firm.staff.map((s) => ({
      id: s.id as RoleId,
      label: roleLabel(s, s.id),
    })),
    { id: "cu-01", label: "Ngozi Okafor · client" },
    { id: "cu-02", label: "Erik Lindqvist · client" },
    { id: "irs-exam", label: "IRS examiner · 2028 notice" },
  ];

  const openFindings = idx.findings.filter((f) => findingVisible(idx, f, work.clock) && !work.resolvedFindings[f.id]);
  const last = work.lastSeen[work.roleId];
  const changedSince = idx.current.changes_from_previous.filter((c) => {
    if (!last) return true;
    return idx.current.computed_at > last;
  });

  const openDocument = (id: string | null) => {
    setDocId(id);
    setView("docs");
  };

  const goClaim = (key: string) => {
    setClaim(key);
    const line = idx.lines.get(key);
    if (line) setArea(areaForLine(line));
    setView("area");
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          Proofboard
          <small>Okafor-Lindqvist · 2025 · {packet.packet.client_id}</small>
        </div>
        <input
          className="search"
          placeholder="Search numbers, documents, people, notes…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setView("search");
          }}
          onFocus={() => setView("search")}
        />
        <div className="grow" />
        <span className={`pill ${blocking ? "block" : "ok"}`}>
          {blocking ? "Filing blocked" : "No filing blocks"}
        </span>
        <span className="pill muted">Now {day(work.clock)}</span>
        <select
          className="role"
          value={work.roleId}
          onChange={(e) => dispatch({ type: "role", roleId: e.target.value as RoleId })}
        >
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </header>

      {work.frozenAt && !work.amendMode && (
        <div className="banner">
          Return frozen at filing ({dt(work.frozenAt)}). Open amend mode to change
          numbers on top of the filed copy.
          <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => dispatch({ type: "amend", on: true })}>
            Amend
          </button>
        </div>
      )}
      {blocking && (
        <div className="banner block">
          Open review notes or unresolved blockers must close before e-file.
        </div>
      )}
      {!clearance && (
        <div className="banner">
          Marcus Bell: SSNs, bank numbers and IP PINs are masked. Reveal logs a view.
          <button
            className="btn ghost"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setReveal(true);
              dispatch({ type: "view", who: work.roleId, what: "Unmasked sensitive fields" });
            }}
          >
            Reveal (logged)
          </button>
        </div>
      )}

      <nav className="nav">
        {(
          [
            ["now", "Now"],
            ["return", "Return"],
            ["area", "Investigations"],
            ["docs", "Documents"],
            ["people", "People"],
            ["filing", "Filing"],
            ["firm", "Firm"],
            ["notice", "Notice pack"],
            ["next", "Next year"],
          ] as [View, string][]
        )
          .filter(([id]) => {
            if (isClient(work.roleId))
              return ["now", "return", "docs", "people", "filing"].includes(id);
            if (isExam(work.roleId))
              return ["notice", "return", "docs", "area"].includes(id);
            return true;
          })
          .map(([id, label]) => (
            <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
      </nav>

      <div className={`shell ${view === "now" || view === "firm" ? "" : ""}`}>
        <aside className="col pad">
          <div className="kicker">Open investigations</div>
          {openFindings.map((f) => (
            <div
              key={f.id}
              className="item"
              onClick={() => {
                setArea(f.area);
                if (f.claimKeys[0]) setClaim(f.claimKeys[0]);
                if (f.refs.find((r) => r.startsWith("D")))
                  setDocId(f.refs.find((r) => r.startsWith("D")) || null);
                setView(f.area === "completeness" ? "docs" : "area");
              }}
            >
              <div className={`sev ${f.severity}`}>{f.severity}</div>
              <div className="title">{f.title}</div>
              <div className="muted">{f.summary.replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1").slice(0, 140)}</div>
            </div>
          ))}
          <div className="kicker" style={{ marginTop: 18 }}>
            Season clock
          </div>
          {packet.timeline.map((t) => (
            <div
              key={t.id}
              className={`tl ${work.clock >= t.at ? "on" : ""}`}
              onClick={() => dispatch({ type: "clock", clock: t.at })}
            >
              <div className="mono muted">{day(t.at)}</div>
              <div>
                {t.event.replaceAll("_", " ")}
                {t.detail ? <div className="muted">{t.detail.slice(0, 90)}</div> : null}
              </div>
            </div>
          ))}
        </aside>

        <main className="col pad">
          {view === "now" && (
            <Now
              last={last}
              changedSince={changedSince}
              goClaim={goClaim}
              setView={setView}
              setArea={setArea}
            />
          )}
          {view === "return" && <ReturnView goClaim={goClaim} clearance={clearance || reveal} />}
          {view === "area" && (
            <AreaView
              area={area}
              setArea={setArea}
              claim={claim}
              setClaim={setClaim}
              setDocId={openDocument}
            />
          )}
          {view === "docs" && (
            <DocsView docId={docId} setDocId={setDocId} setClaim={setClaim} />
          )}
          {view === "people" && <PeopleView />}
          {view === "filing" && <FilingView />}
          {view === "firm" && <FirmView />}
          {view === "notice" && <NoticeView goClaim={goClaim} setDocId={openDocument} />}
          {view === "next" && <NextView />}
          {view === "search" && (
            <SearchView
              q={q}
              goClaim={goClaim}
              setDocId={setDocId}
              setView={setView}
            />
          )}
        </main>

        <aside className="col">
          <ProofDock
            claim={claim}
            docId={docId}
            setDocId={openDocument}
            setClaim={setClaim}
            clearance={clearance || reveal}
          />
        </aside>
      </div>
    </div>
  );
}

function Now({
  last,
  changedSince,
  goClaim,
  setView,
  setArea,
}: {
  last?: string;
  changedSince: { key: string; change: string; old: unknown; new: unknown }[];
  goClaim: (k: string) => void;
  setView: (v: View) => void;
  setArea: (a: AreaId) => void;
}) {
  const { idx, work, displayValue, packet } = useWP();
  if (!idx || !packet) return null;
  const fed = idx.current.summary.federal;
  const ca = idx.current.summary.california;
  const pyAgi = num(idx.prior.get("F1040.11"));
  const vAt = versionAt(idx, work.clock);

  return (
    <>
      <div className="kicker">The situation</div>
      <h1>Prove this return — don’t re-key it.</h1>
      <p className="muted">
        Three things must agree: the documents, independent arithmetic, and the
        engine. Disagreement is an investigation. Engine version in force at this
        clock: <b>{vAt.version}</b> ({vAt.trigger}).
      </p>
      <div className="statrow">
        <div className="stat">
          <div className="lbl">Federal tax</div>
          <div className="n">{money(fed.total_tax)}</div>
          <div className="sub">Balance due {money(fed.balance_due)}</div>
        </div>
        <div className="stat">
          <div className="lbl">California</div>
          <div className="n">{money(ca.total_tax)}</div>
          <div className="sub">
            {ca.balance_due < 0 ? `Refund ${money(-ca.balance_due)}` : `Due ${money(ca.balance_due)}`}
          </div>
        </div>
        <div className="stat">
          <div className="lbl">AGI vs 2024</div>
          <div className="n">{money(displayValue("F1040.11"))}</div>
          <div className="sub">Last year {money(pyAgi)}</div>
        </div>
        <div className="stat">
          <div className="lbl">Still open</div>
          <div className="n">
            {idx.findings.filter((f) => !work.resolvedFindings[f.id]).length}
          </div>
          <div className="sub">
            {work.reviewNotes.filter((n) => n.blocking && !n.resolved).length} blocking notes
          </div>
        </div>
      </div>

      <div className="two">
        <div>
          <h2>Since you last looked</h2>
          <p className="muted">{last ? dt(last) : "First session in this role."}</p>
          {changedSince.slice(0, 12).map((c) => (
            <div key={c.key} className="claim" onClick={() => goClaim(c.key)}>
              <div>
                <div className="mono">{c.key}</div>
                <div className="muted">{idx.lines.get(c.key)?.label}</div>
              </div>
              <div className="amt">
                {money(c.old)} → {money(c.new)}
              </div>
            </div>
          ))}
          {!changedSince.length && <p className="muted">No engine changes since your last visit.</p>}
        </div>
        <div>
          <h2>Required steps</h2>
          {packet.firm.starter_standards.required_steps.map((s) => (
            <div key={s} className="card">
              {s}
            </div>
          ))}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setArea("investments"); setView("area"); }}>
              Open brokerage recon
            </button>
            <button className="btn ghost" onClick={() => setView("docs")}>
              Document index
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ReturnView({
  goClaim,
  clearance,
}: {
  goClaim: (k: string) => void;
  clearance: boolean;
}) {
  const { idx, packet, work, displayValue, dispatch } = useWP();
  if (!idx || !packet) return null;
  const people = packet.household.people as {
    id: string;
    name: string;
    role: string;
    ssn: string;
    dob: string;
  }[];
  const keys = headlineKeys.filter((k) => idx.lines.has(k));
  const what = packet.what_if.alternatives as {
    id: string;
    description: string;
    federal: { total_tax_change: number };
    california: { total_tax_change: number };
  }[];

  return (
    <>
      <div className="kicker">Return vs last year</div>
      <h1>The claim the IRS will see</h1>
      <div className="card">
        {people.map((p) => (
          <div key={p.id} className="claim" style={{ cursor: "default" }}>
            <div>
              <b>{p.name}</b> · {p.role} · born {p.dob}
            </div>
            <div className="mono">
              {maskValue(p.ssn, "ssn", clearance)}
            </div>
          </div>
        ))}
        <div className="muted">
          MFJ · CA resident to Jul 14 · TX from Jul 15 · prior preparer Delta River
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Claim</th>
            <th>2025</th>
            <th>2024</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const now = num(displayValue(k));
            const py = num(idx.prior.get(k));
            const delta = now != null && py != null ? now - py : null;
            return (
              <tr key={k} onClick={() => goClaim(k)}>
                <td>
                  <div className="mono">{k}</div>
                  {idx.lines.get(k)?.label}
                </td>
                <td className="amt">{money(now)}</td>
                <td className="amt">{money(py)}</td>
                <td className="amt">{delta == null ? "—" : moneySigned(delta)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h2 style={{ marginTop: 22 }}>What-ifs (engine already ran these)</h2>
      <div className="two">
          {what.map((w) => (
          <div
            key={w.id}
            className={`item ${work.selectedWhatIf === w.id ? "on" : ""}`}
            onClick={() =>
              dispatch({
                type: "whatIf",
                id: work.selectedWhatIf === w.id ? null : w.id,
              })
            }
          >
            <div className="title">{w.description}</div>
            <div className="muted">
              Federal tax {moneySigned(w.federal.total_tax_change)} · California{" "}
              {moneySigned(w.california.total_tax_change)}
            </div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 22 }}>Carryovers out</h2>
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(idx.current.carryovers_out, null, 2)}
      </pre>
    </>
  );
}

function AreaView({
  area,
  setArea,
  claim,
  setClaim,
  setDocId,
}: {
  area: AreaId;
  setArea: (a: AreaId) => void;
  claim: string | null;
  setClaim: (k: string) => void;
  setDocId: (id: string | null) => void;
}) {
  const { idx, work, dispatch, displayValue } = useWP();
  if (!idx) return null;
  const meta = AREAS.find((a) => a.id === area)!;
  const findings = idx.findings.filter((f) => f.area === area);
  const lines =
    area === "crypto"
      ? idx.current.lines.filter(
          (l) =>
            areaForLine(l) === "crypto" ||
            /coinhaven|digital|btc|eth/i.test(l.label)
        )
      : idx.current.lines.filter((l) => areaForLine(l) === area && l.form !== "F8949");
  const lots = idx.current.lines.filter((l) => l.form === "F8949");
  const grouped = groupLots(lots);
  const [onlyEx, setOnlyEx] = useState(true);
  const assets = idx.current.assets;

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        {AREAS.map((a) => (
          <button
            key={a.id}
            className={`btn ${a.id === area ? "" : "ghost"}`}
            onClick={() => setArea(a.id)}
          >
            {a.title}
          </button>
        ))}
      </div>
      <div className="kicker">{meta.title}</div>
      <h1>{meta.blurb}</h1>

      {findings.map((f) => (
        <div key={f.id} className="card">
          <div className={`sev ${f.severity}`}>{f.severity}</div>
          <h3>{f.title}</h3>
          <p>{f.summary.replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1")}</p>
          <p className="muted">Surfaced by: {f.howSurfaced}</p>
          {f.taxHint && <p className="muted">{f.taxHint}</p>}
          <div className="row">
            {f.refs.slice(0, 6).map((r) => (
              <button
                key={r}
                className="btn ghost"
                onClick={() => {
                  if (r.startsWith("doc:D")) setDocId(r.slice(4).split("#")[0]);
                  else if (r.startsWith("D")) setDocId(r.split("#")[0]);
                  else if (idx.lines.has(r)) setClaim(r);
                }}
              >
                {r}
              </button>
            ))}
            {work.resolvedFindings[f.id] ? (
              <span className="pill ok">Resolved</span>
            ) : (
              <button
                className="btn"
                onClick={() =>
                  dispatch({
                    type: "resolveFinding",
                    id: f.id,
                    who: work.roleId,
                    how: "Reviewed on Proofboard",
                  })
                }
              >
                Mark reviewed
              </button>
            )}
          </div>
        </div>
      ))}

      {area === "investments" && (
        <>
          <div className="row">
            <h2>Sales — exceptions first</h2>
            <label>
              <input
                type="checkbox"
                checked={onlyEx}
                onChange={(e) => setOnlyEx(e.target.checked)}
              />{" "}
              Hide ordinary covered lots
            </label>
          </div>
          {Object.entries(grouped).map(([broker, rows]) => {
            const proceeds = rows.reduce((s, l) => s + lotField(l, "proceeds"), 0);
            const shown = onlyEx ? rows.filter(isExceptionLot) : rows;
            return (
              <div key={broker} className="card">
                <h3>{broker}</h3>
                <div className="muted">
                  {rows.length} lots · proceeds {money(proceeds, true)} ·{" "}
                  {rows.filter(isExceptionLot).length} exceptions
                </div>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Lot</th>
                      <th>Proceeds</th>
                      <th>Basis</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, 80).map((l) => (
                      <tr
                        key={l.key}
                        className={claim === l.key ? "on" : isExceptionLot(l) ? "ex" : ""}
                        onClick={() => setClaim(l.key)}
                      >
                        <td>{l.label.split("(")[0]}</td>
                        <td className="amt">{money(lotField(l, "proceeds"), true)}</td>
                        <td className="amt">{money(lotField(l, "basis"), true)}</td>
                        <td>{lotFlag(l)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {area === "rentals" || area === "business" ? (
        <>
          <h2>Assets — federal / California / AMT</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Method / life</th>
                <th>Fed 2025</th>
                <th>CA 2025</th>
                <th>AMT Δ</th>
                <th>Disposed</th>
              </tr>
            </thead>
            <tbody>
              {assets
                .filter((a) =>
                  area === "business"
                    ? /studio|stu/i.test(a.activity + a.asset_id)
                    : /rental|fremont|barton|sac/i.test(a.activity + a.asset_id)
                )
                .map((a) => (
                  <tr key={a.asset_id}>
                    <td>
                      <b>{a.asset_id}</b>
                      <div className="muted">{a.description}</div>
                    </td>
                    <td>
                      {a.method} · {a.life_years} yrs
                    </td>
                    <td>{money(a.federal.depreciation_2025)}</td>
                    <td>{money(a.california.depreciation_2025)}</td>
                    <td>{money(a.amt.difference_from_regular)}</td>
                    <td>{a.disposed ? JSON.stringify(a.disposed) : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : null}

      {area === "passthroughs" && (
        <pre className="card" style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(idx.packet.prior_years.basis_records, null, 2)}
        </pre>
      )}

      <h2>Area claims</h2>
      {lines.slice(0, 80).map((l) => (
        <ClaimRow
          key={l.key}
          line={l}
          on={claim === l.key}
          onClick={() => setClaim(l.key)}
          value={displayValue(l.key)}
        />
      ))}
    </>
  );
}

function ClaimRow({
  line,
  on,
  onClick,
  value,
}: {
  line: Line;
  on: boolean;
  onClick: () => void;
  value: unknown;
}) {
  const { idx, work } = useWP();
  const py = idx?.prior.get(line.key);
  const verified = work.verifications.some((v) => v.claimKey === line.key);
  const adjusted = work.adjustments.some((a) => a.claimKey === line.key);
  return (
    <div className="claim" onClick={onClick} style={{ background: on ? "#fff4e8" : undefined }}>
      <div>
        <div>
          {line.label} <span className="mono muted">{line.key}</span>
        </div>
        <div className="pips">
          <span className={`pip ${line.sources?.length ? "on" : ""}`} title="sourced" />
          <span className={`pip ${line.inputs?.length || line.rule ? "on" : ""}`} title="built" />
          <span className={`pip ${verified ? "on" : ""}`} title="verified" />
          <span className={`pip ${adjusted ? "warn" : ""}`} title="adjusted" />
        </div>
      </div>
      <div>
        <div className="amt">{fmt(value)}</div>
        {py != null && <div className="muted">2024 {fmt(py)}</div>}
      </div>
    </div>
  );
}

function fmt(v: unknown) {
  if (typeof v === "number") return money(v, Math.abs(v) < 100 && v % 1 !== 0);
  if (v == null) return "—";
  return String(v);
}

function groupLots(lots: Line[]) {
  const g: Record<string, Line[]> = {};
  for (const l of lots) {
    const broker = l.label.includes("Coinhaven")
      ? "Coinhaven"
      : l.label.includes("Corvane")
        ? "Corvane / RSU"
        : l.label.includes("Brightpath")
          ? "Brightpath"
          : l.label.includes("Northlake")
            ? "Northlake"
            : "Meridian / other";
    (g[broker] ||= []).push(l);
  }
  return g;
}
function lotField(l: Line, which: "proceeds" | "basis") {
  const m = new RegExp(which + "\\s([\\d,]+\\.\\d{2})", "i").exec(l.label);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}
function isExceptionLot(l: Line) {
  return /basis 0\.00|wash sale|noncovered|C6|no cost/i.test(l.label);
}
function lotFlag(l: Line) {
  if (/basis 0\.00/.test(l.label)) return "zero basis";
  if (/wash sale/i.test(l.label) && !/disallowed 0\.00/.test(l.label)) return "wash sale";
  if (/noncovered/i.test(l.label)) return "noncovered";
  return "";
}

function DocsView({
  docId,
  setDocId,
  setClaim,
}: {
  docId: string | null;
  setDocId: (id: string | null) => void;
  setClaim: (k: string) => void;
}) {
  const { idx, work } = useWP();
  if (!idx) return null;
  const docs = visibleDocs(idx, work.clock);
  // Never silently display D01 when the requested document has not arrived.
  const current = docId ? docs.find((d) => d.id === docId) : docs[0];
  const unavailable = docId ? idx.docs.get(docId) : null;
  const landings = current ? idx.docToLines.get(current.id) || [] : [];
  const evs = current ? idx.evByDoc.get(current.id) || [] : [];
  const staff = idx.packet.firm.staff.find((s) => s.id === work.roleId);
  const clearance = staff?.sensitive_data_clearance ?? false;

  return (
    <>
      <div className="kicker">Document evidence</div>
      <h1>{current ? `${current.id} · ${current.title}` : "Document not yet available"}</h1>
      {docId && !current && (
        <div className="card" role="status">
          {unavailable
            ? `${docId} has not arrived at this point in the season. Received: ${dt(unavailable.received_at)}. Move the Season clock forward to view it.`
            : `${docId} does not exist in the source packet.`}
        </div>
      )}
      {current && (
        <div className="selected-document" data-testid="selected-document">
          <p className="muted">
            {current.issuer} · received {dt(current.received_at)} · {current.file_name}
          </p>
          {current.extraction.reason && (
            <div className="card">Pipeline: {current.extraction.reason}</div>
          )}
          <DispositionForm key={current.id} id={current.id} />
          {current.pages.map((p) => (
            <DocPage
              key={`${current.id}-${p.page}`}
              text={p.printed_content}
              page={p.page}
              highlights={evs.filter((e) => e.page === p.page)}
              clearance={clearance}
            />
          ))}
          <h3>Where it landed</h3>
          {landings.length === 0 && (
            <p className="muted">No return line cites this document. It may support a filing check or identity review instead.</p>
          )}
          {landings.map((l) => (
            <div key={l.key} className="claim" onClick={() => setClaim(l.key)}>
              <div>{l.label} <span className="mono muted">{l.key}</span></div>
              <div className="amt">{fmt(l.value)}</div>
            </div>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 18 }}>Document index · {docs.length} received</h2>
      <table className="data">
        <thead>
          <tr>
            <th>ID</th>
            <th>Document</th>
            <th>Extract</th>
            <th>Landed</th>
            <th>Disposition</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const n = (idx.docToLines.get(d.id) || []).length;
            const disp =
              work.dispositions[d.id]?.status ||
              (idx.current.documents_superseded?.includes(d.id)
                ? "superseded"
                : n
                  ? "used"
                  : "open");
            return (
              <tr
                key={d.id}
                className={current?.id === d.id ? "on" : ""}
                onClick={() => setDocId(d.id)}
              >
                <td className="mono">{d.id}</td>
                <td>{d.title}{d.marked_corrected ? " · CORRECTED" : ""}</td>
                <td>{d.extraction.status}</td>
                <td>{n} claims</td>
                <td>{disp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function DispositionForm({ id }: { id: string }) {
  const { work, dispatch } = useWP();
  const [why, setWhy] = useState(work.dispositions[id]?.why || "");
  const [status, setStatus] = useState(work.dispositions[id]?.status || "used");
  return (
    <div className="row" style={{ margin: "8px 0" }}>
      <select className="plain" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option>used</option>
        <option>duplicate</option>
        <option>superseded</option>
        <option>out_of_scope</option>
        <option>not_tax</option>
        <option>held_for_exam</option>
      </select>
      <input className="field" style={{ flex: 1 }} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why this file is in or out" />
      <button className="btn" onClick={() => dispatch({ type: "dispose", id, status, why })}>
        Save disposition
      </button>
    </div>
  );
}

// For this synthetic packet, text_as_read and printed_content are the source of
// truth. We highlight an exact text match, not an invented rectangle on a PDF.
function DocPage({
  text,
  page,
  highlights,
  clearance,
}: {
  text: string;
  page: number;
  highlights: Extracted[];
  clearance: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = highlights.find((h) => h.id === selectedId) || highlights[0];
  const conceal = (value: string) =>
    clearance
      ? value
      : value.replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1");
  const pageText = conceal(text);
  const sourceText = selected ? conceal(String(selected.text_as_read || selected.value || "")) : "";
  const pos = sourceText.length >= 2 ? pageText.indexOf(sourceText) : -1;
  return (
    <section className="doc-section">
      <div className="muted" style={{ marginBottom: 7 }}>Simulated source · page {page}</div>
      <div className="docpage" data-testid={`source-page-${page}`}>
        {pos < 0 ? pageText : (
          <>
            {pageText.slice(0, pos)}
            <mark className="source-focus" title={selected?.label}>
              {pageText.slice(pos, pos + sourceText.length)}
            </mark>
            {pageText.slice(pos + sourceText.length)}
          </>
        )}
      </div>
      {highlights.length > 0 && (
        <div className="field-chooser">
          <div className="kicker">Extracted fields · select a field to locate it in the printed source</div>
          {highlights.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`field-chip ${selected?.id === h.id ? "selected" : ""}`}
              onClick={() => setSelectedId(h.id)}
              title={`${h.field} • ${Math.round(h.confidence * 100)}% extraction confidence`}
            >
              {h.label}: {maskValue(h.value, h.value_type, clearance)}
              <span className="muted"> · {h.id} · {Math.round(h.confidence * 100)}%</span>
            </button>
          ))}
          {selected && pos < 0 && (
            <p className="muted">This extracted value has no exact text match on the simulated page. Review it manually; the extraction may be wrong or the printed text may use a different format.</p>
          )}
        </div>
      )}
    </section>
  );
}

function PeopleView() {
  const { packet, work, dispatch, idx } = useWP();
  if (!packet || !idx) return null;
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [blocking, setBlocking] = useState(true);
  return (
    <>
      <div className="kicker">People</div>
      <h1>Questions become evidence. Sign-offs reopen when facts move.</h1>
      <h2>Ask</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Question to client or colleague" />
      <div className="row" style={{ margin: "8px 0 16px" }}>
        <button
          className="btn"
          onClick={() => {
            if (!text.trim()) return;
            dispatch({
              type: "question",
              q: {
                id: uid(),
                to: "client",
                toName: "Ngozi & Erik",
                text,
                who: work.roleId,
                at: new Date().toISOString(),
                evidence: false,
                refs: [],
              },
            });
            setText("");
          }}
        >
          Send to client
        </button>
      </div>
      {work.questions.map((q) => (
        <div key={q.id} className="card">
          <div className="muted">
            {q.toName} · {dt(q.at)} · {q.evidence ? "evidence" : "open"}
          </div>
          <div>{q.text}</div>
          {q.answer ? (
            <div className="muted">Answer: {q.answer}</div>
          ) : isClient(work.roleId) ? (
            <AnswerBox id={q.id} />
          ) : null}
        </div>
      ))}
      <h2>Review notes (can block filing)</h2>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <label>
        <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} />{" "}
        Blocks e-file
      </label>
      <button
        className="btn"
        onClick={() => {
          if (!note.trim()) return;
          dispatch({ type: "note", area: "return", text: note, who: work.roleId, blocking });
          setNote("");
        }}
      >
        Add note
      </button>
      {work.reviewNotes.map((n) => (
        <div key={n.id} className="card">
          <span className={`sev ${n.blocking && !n.resolved ? "block" : "info"}`}>
            {n.resolved ? "resolved" : n.blocking ? "blocking" : "note"}
          </span>
          <div>{n.text}</div>
          {!n.resolved && (
            <button className="btn ghost" onClick={() => dispatch({ type: "resolveNote", id: n.id, who: work.roleId })}>
              Resolve
            </button>
          )}
        </div>
      ))}
      <h2>Sign-offs</h2>
      {(["preparer", "reviewer", "partner"] as const).map((level) => (
        <button
          key={level}
          className="btn ghost"
          disabled={!canSignLevel(work, level, work.roleId)}
          title={canSignLevel(work, level, work.roleId)
            ? `Sign as assigned ${level}`
            : `Only the assigned ${level} may sign, and signers must be independent`}
          onClick={() => {
            const snap = idx.current.lines
              .slice(0, 20)
              .map((l) => l.key + "=" + JSON.stringify(l.value))
              .join("|");
            dispatch({
              type: "sign",
              s: {
                id: uid(),
                area: "return",
                level,
                who: work.roleId,
                at: new Date().toISOString(),
                snapshot: snap,
                open: false,
              },
            });
          }}
        >
          Sign as {level}
        </button>
      ))}
      <p className="muted">Only the assigned preparer, reviewer, or partner can sign. Reviewers cannot sign their own prepared work.</p>
      {work.signoffs.map((s) => {
        const allowedWhenSigned =
          s.level !== "client" &&
          work.assignments[s.level] === s.who &&
          (s.level === "preparer" || s.who !== work.assignments.preparer) &&
          (s.level !== "partner" || s.who !== work.assignments.reviewer);
        return (
          <div key={s.id} className="card">
            {s.level} · {s.who} · {dt(s.at)} · {allowedWhenSigned
              ? s.open ? `REOPENED: ${s.reopenReason}` : "closed"
              : "INVALID SIGNER — previous test record (do not count as approval)"}
          </div>
        );
      })}
      <h2>Messages already in the packet (evidence)</h2>
      {packet.client.messages.map((m) => (
        <div key={m.id} className="card">
          <div className="muted">
            {m.id} · {dt(m.sent_at)} · {m.from} → {m.to}
          </div>
          {m.text}
        </div>
      ))}
      <h2>Questionnaire</h2>
      {packet.client.questionnaire.map((qa) => (
        <div key={qa.id} className="claim" style={{ cursor: "default" }}>
          <div>
            <span className="mono">{qa.id}</span> {qa.question}
          </div>
          <div>{qa.answer}</div>
        </div>
      ))}
    </>
  );
}

function AnswerBox({ id }: { id: string }) {
  const { dispatch, work } = useWP();
  const [a, setA] = useState("");
  return (
    <div className="row">
      <input className="field" value={a} onChange={(e) => setA(e.target.value)} />
      <button className="btn" onClick={() => dispatch({ type: "answerQ", id, answer: a, who: work.roleId })}>
        Answer (becomes evidence)
      </button>
    </div>
  );
}

function FilingView() {
  const { packet, work, dispatch, blocking, idx, displayValue } = useWP();
  if (!packet || !idx) return null;
  const efile = packet.tax_agency_records.efile as {
    date: string;
    jurisdiction: string;
    status: string;
    errors?: { code: string; message: string }[];
  }[];
  return (
    <>
      <div className="kicker">Filing and after</div>
      <h1>Extend, file, freeze, then amend on top.</h1>
      <div className="card">
        Extension in packet: Form 4868 with $36,000 from the April v2 estimate.
        Replay the extension event on the season clock to see the world as of April 14.
      </div>
      <h2>E-file</h2>
      {efile.map((e, i) => (
        <div key={i} className="card">
          <b>{e.jurisdiction}</b> · {e.status} · {dt(e.date)}
          {e.errors?.map((er) => (
            <div key={er.code} className="muted">
              {er.code}: {er.message}
            </div>
          ))}
        </div>
      ))}
      <div className="row">
        <button
          className="btn"
          disabled={blocking || (!!work.frozenAt && !work.amendMode)}
          onClick={() => {
            const at = new Date().toISOString();
            dispatch({ type: "freeze", at, snapshot: createFiledSnapshot(work, idx, at) });
          }}
        >
          {work.frozenAt ? work.amendMode ? "Freeze amended version" : "Filed version saved" : "Freeze as filed"}
        </button>
        <button
          className="btn ghost"
          disabled={!work.frozenAt || work.amendMode}
          onClick={() => dispatch({ type: "amend", on: true })}
        >
          Open amendment
        </button>
      </div>
      {blocking && <p className="muted">Clear blockers before freeze/e-file.</p>}
      <h2>Filed snapshot & amendment comparison</h2>
      {work.filedSnapshots.length === 0 ? (
        <p className="muted">No saved filed snapshot yet. Freeze the return to create one.</p>
      ) : (
        <div className="card">
          <p className="muted">
            Stored in this browser for the demo. Original snapshots are retained when amendments are filed.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Version</th>
                <th>Filed</th>
                <th>AGI (F1040.11)</th>
                <th>Engine</th>
              </tr>
            </thead>
            <tbody>
              {work.filedSnapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>
                    {snapshot.kind === "original" ? "Original" : "Amended"}
                    {snapshot.origin === "legacy-reconstructed" && (
                      <div className="muted">Reconstructed from prior browser history; not verified filed data</div>
                    )}
                  </td>
                  <td>{dt(snapshot.filedAt)}</td>
                  <td className="amt">{money(snapshot.lineValues["F1040.11"])}</td>
                  <td>{snapshot.engineVersion}</td>
                </tr>
              ))}
              <tr>
                <td><b>{work.amendMode ? "Working amendment" : "Current working values"}</b></td>
                <td>Not a filed snapshot</td>
                <td className="amt"><b>{money(displayValue("F1040.11"))}</b></td>
                <td>Live workpaper</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            Each saved filing also captures engine totals, document IDs, adjustment history,
            verification records, sign-offs and client demo-approval timestamps.
          </p>
        </div>
      )}
      <h2>Client approval & 8879</h2>
      <p className="muted">
        Prior-year AGI for e-signature: {money(packet.household.prior_year_agi_for_esignature)}
      </p>
      <p className="muted">
        Demo approval only: switch to the matching client role to approve.
        No PIN is displayed or saved. This is not a legally binding electronic signature.
      </p>
      <div className="row">
        <button
          className="btn"
          disabled={work.roleId !== "cu-01" || work.clientApproval.ngozi?.pin === "not-stored"}
          onClick={() => dispatch({ type: "approve", who: "ngozi", pin: "" })}
        >
          Ngozi — approve (demo)
        </button>
        <button
          className="btn"
          disabled={work.roleId !== "cu-02" || work.clientApproval.erik?.pin === "not-stored"}
          onClick={() => dispatch({ type: "approve", who: "erik", pin: "" })}
        >
          Erik — approve (demo)
        </button>
      </div>
      <pre className="card">
        {JSON.stringify({
          ngozi: work.clientApproval.ngozi?.pin === "not-stored"
            ? { status: "Demo approved", at: work.clientApproval.ngozi.at }
            : { status: work.clientApproval.ngozi ? "Invalid legacy test approval" : "Not approved" },
          erik: work.clientApproval.erik?.pin === "not-stored"
            ? { status: "Demo approved", at: work.clientApproval.erik.at }
            : { status: work.clientApproval.erik ? "Invalid legacy test approval" : "Not approved" },
        }, null, 2)}
      </pre>
      <h2>Client copy (no workpaper noise)</h2>
      <div className="statrow">
        <div className="stat">
          <div className="lbl">You owe IRS</div>
          <div className="n">{money(idx.current.summary.federal.balance_due)}</div>
        </div>
        <div className="stat">
          <div className="lbl">California</div>
          <div className="n">{money(idx.current.summary.california.balance_due)}</div>
        </div>
      </div>
    </>
  );
}

function FirmView() {
  const { packet, work, dispatch } = useWP();
  if (!packet) return null;
  const budget = packet.firm.budget_hours;
  const hours: Record<string, number> = {};
  for (const t of work.timeEntries) hours[t.area] = (hours[t.area] || 0) + t.hours;
  const [h, setH] = useState("0.3");
  const [area, setArea] = useState(Object.keys(budget)[0]);
  return (
    <>
      <div className="kicker">Firm</div>
      <h1>Standards, sensitive data, time, status.</h1>
      <h2>Standards</h2>
      {(work.standards.length ? work.standards : packet.firm.starter_standards.rules).map(
        (r, i) => (
          <div key={i} className="card">
            {r}
          </div>
        )
      )}
      {work.roleId === "st-05" && (
        <button
          className="btn ghost"
          onClick={() =>
            dispatch({
              type: "standards",
              rules: [
                ...packet.firm.starter_standards.rules,
                "Crypto transfer-ins with empty basis cannot be signed without a client basis statement.",
              ],
            })
          }
        >
          Add firm standard (admin)
        </button>
      )}
      <h2>Time vs budget</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Area</th>
            <th>Budget</th>
            <th>Logged</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(budget).map(([k, v]) => (
            <tr key={k}>
              <td>{k.replaceAll("_", " ")}</td>
              <td>{v}</td>
              <td>{(hours[k] || 0).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <select className="plain" value={area} onChange={(e) => setArea(e.target.value)}>
          {Object.keys(budget).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input className="field" value={h} onChange={(e) => setH(e.target.value)} style={{ width: 80 }} />
        <button
          className="btn"
          onClick={() =>
            dispatch({
              type: "time",
              e: {
                id: uid(),
                who: work.roleId,
                area,
                hours: Number(h) || 0,
                at: new Date().toISOString(),
                note: "Logged from Proofboard",
              },
            })
          }
        >
          Log time
        </button>
      </div>
      <h2>Sensitive view log</h2>
      {work.viewLogs.length === 0 && <p className="muted">No unmasked views yet.</p>}
      {work.viewLogs.map((v, i) => (
        <div key={i} className="muted">
          {dt(v.at)} · {v.who} · {v.what}
        </div>
      ))}
      <h2>Assignments</h2>
      {Object.entries(work.assignments).map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn danger" onClick={() => dispatch({ type: "reset" })}>
          Reset workpaper (keeps packet)
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "undo" })}>
          Undo last adjustment
        </button>
      </div>
    </>
  );
}

function NoticeView({
  goClaim,
  setDocId,
}: {
  goClaim: (k: string) => void;
  setDocId: (id: string | null) => void;
}) {
  const { packet, idx } = useWP();
  if (!packet || !idx) return null;
  const notices = packet.tax_agency_records.notices as {
    id: string;
    type: string;
    dated: string;
    summary?: string;
    items_under_examination?: string[];
    document?: string;
    response_due?: string;
  }[];
  return (
    <>
      <div className="kicker">Self-contained exam file</div>
      <h1>Answer the notice from this record alone.</h1>
      {notices.map((n) => (
        <div key={n.id} className="card">
          <h3>
            {n.type} · {n.dated}
          </h3>
          {n.summary && <p>{n.summary}</p>}
          {n.items_under_examination?.map((it) => (
            <p key={it}>{it}</p>
          ))}
          {n.document && (
            <button className="btn ghost" onClick={() => setDocId(n.document!)}>
              Open {n.document}
            </button>
          )}
          {n.response_due && <p className="muted">Respond by {n.response_due}</p>}
        </div>
      ))}
      <p>
        Charitable: open D64–D66 and SchA. Schedule C receipts: open the 1099 recon
        on SchC.1 ({money(idx.lines.get("SchC.1")?.value)}).
      </p>
      <button className="btn" onClick={() => goClaim("SchC.1")}>
        Jump to SchC.1 proof
      </button>
    </>
  );
}

function NextView() {
  const { packet, idx } = useWP();
  if (!packet || !idx) return null;
  return (
    <>
      <div className="kicker">Roll forward</div>
      <h1>History travels. Next year’s preparer does not start from a PDF.</h1>
      <h2>Carry into 2026</h2>
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(idx.current.carryovers_out, null, 2)}
      </pre>
      <h2>Planning</h2>
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(packet.planning_reference_2026, null, 2)}
      </pre>
      <h2>What we changed vs the prior preparer</h2>
      <p className="muted">
        Delta River prepared 2024. This file keeps their memo (D07, not extracted)
        beside every 2025 adjustment, so the next preparer sees the human trail.
      </p>
    </>
  );
}

function SearchView({
  q,
  goClaim,
  setDocId,
  setView,
}: {
  q: string;
  goClaim: (k: string) => void;
  setDocId: (id: string | null) => void;
  setView: (v: View) => void;
}) {
  const { idx, packet } = useWP();
  const needle = q.trim().toLowerCase();
  const lines = useMemo(() => {
    if (!idx || needle.length < 2) return [];
    return idx.current.lines
      .filter(
        (l) =>
          l.key.toLowerCase().includes(needle) ||
          l.label.toLowerCase().includes(needle) ||
          String(l.value).includes(needle)
      )
      .slice(0, 30);
  }, [idx, needle]);
  const docs = useMemo(() => {
    if (!packet || needle.length < 2) return [];
    return packet.documents
      .filter(
        (d) =>
          d.id.toLowerCase().includes(needle) ||
          d.title.toLowerCase().includes(needle) ||
          d.pages.some((p) => p.printed_content.toLowerCase().includes(needle))
      )
      .slice(0, 20);
  }, [packet, needle]);
  return (
    <>
      <h1>Search</h1>
      {lines.map((l) => (
        <div key={l.key} className="claim" onClick={() => goClaim(l.key)}>
          <div>
            {l.label} <span className="mono">{l.key}</span>
          </div>
          <div className="amt">{fmt(l.value)}</div>
        </div>
      ))}
      {docs.map((d) => (
        <div
          key={d.id}
          className="item"
          onClick={() => {
            setDocId(d.id);
            setView("docs");
          }}
        >
          {d.id} · {d.title}
        </div>
      ))}
    </>
  );
}

function ProofDock({
  claim,
  docId,
  setDocId,
  setClaim,
  clearance,
}: {
  claim: string | null;
  docId: string | null;
  setDocId: (id: string | null) => void;
  setClaim: (k: string) => void;
  clearance: boolean;
}) {
  const { idx, work, dispatch, displayValue, taxEffect } = useWP();
  const [why, setWhy] = useState("");
  const [to, setTo] = useState("");
  const [vnote, setVnote] = useState("");
  if (!idx) return null;
  const line = claim ? idx.lines.get(claim) : undefined;
  const tree = claim ? construction(idx, claim) : null;
  const sources = (line?.sources || [])
    .map((s) => idx.ev.get(s))
    .filter(Boolean) as Extracted[];
  const related = (line?.inputs || []).concat(
    idx.current.lines.filter((l) => l.inputs?.includes(claim || "")).map((l) => l.key)
  );
  const hist = work.adjustments.filter((a) => a.claimKey === claim);
  const engineVal = line?.value;
  const shown = claim ? displayValue(claim) : null;
  const py = claim ? idx.prior.get(claim) : null;
  const rule = line ? idx.packet.engine_reference.rules[line.rule] : "";
  const versions = idx.packet.return_versions.map((v) => ({
    v: v.version,
    val: v.lines.find((l) => l.key === claim)?.value,
  }));

  return (
    <div className="pad">
      <div className="kicker">Proof</div>
      {!line && <p className="muted">Select a number. The proof stays attached to it.</p>}
      {line && (
        <>
          <h2>{line.label}</h2>
          <div className="mono muted">{line.key}</div>
          <div className="stat">
            <div className="lbl">Workpaper</div>
            <div className="n">{fmt(shown)}</div>
            <div className="sub">Engine {fmt(engineVal)} · 2024 {fmt(py)}</div>
          </div>
          {work.selectedWhatIf && <div className="card">What-if overlay on.</div>}
          <h3>How it was built</h3>
          <p className="muted">
            {line.rule}: {rule}
          </p>
          {tree && <Tree node={tree} setClaim={setClaim} />}
          <h3>Exact sources</h3>
          {sources.length === 0 && (
            <p className="muted">{line.note || "No extracted-value sources on this line."}</p>
          )}
          {sources.map((s) => (
            <div
              key={s.id}
              className="item"
              onClick={() => setDocId(s.document_id)}
            >
              <div className="mono">
                {s.id} · {s.document_id} p.{s.page}
              </div>
              <div>
                {s.label}:{" "}
                {maskValue(s.value, s.value_type, clearance)}
              </div>
              <div className="muted">
                Read “{maskValue(s.text_as_read, s.value_type, clearance)}” · confidence {Math.round(s.confidence * 100)}%
              </div>
            </div>
          ))}
          {line.note && <p>{line.note}</p>}
          {docId && idx.docs.get(docId) && (
            <p className="muted">Document docked: {docId}. Open Documents to read the page.</p>
          )}
          <h3>Independent check</h3>
          <Indep line={line} />
          <h3>Verify</h3>
          <div className="row">
            {idx.packet.firm.starter_standards.verification_types.map((t) => (
              <button
                key={t}
                className="btn ghost"
                onClick={() =>
                  dispatch({
                    type: "verify",
                    claimKey: line.key,
                    vtype: t,
                    who: work.roleId,
                    note: vnote,
                  })
                }
              >
                {t.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <input
            className="field"
            placeholder="Verification note"
            value={vnote}
            onChange={(e) => setVnote(e.target.value)}
            style={{ margin: "8px 0" }}
          />
          <h3>Adjust (keep the original)</h3>
          <input
            className="field"
            placeholder="New value"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <input
            className="field"
            placeholder="Why"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            style={{ margin: "8px 0" }}
          />
          <button
            className="btn"
            onClick={() => {
              const n = Number(to);
              const from = num(shown) ?? shown;
              const delta = Number.isFinite(n) && typeof from === "number" ? n - from : 0;
              const fx = taxEffect(line.key, delta);
              dispatch({
                type: "adjust",
                adj: {
                  id: uid(),
                  claimKey: line.key,
                  from: shown,
                  to: Number.isFinite(n) ? n : to,
                  who: work.roleId,
                  why: why || "Adjustment",
                  at: new Date().toISOString(),
                  category: "review",
                  federalEffect: fx.fed,
                  californiaEffect: fx.ca,
                },
              });
              setWhy("");
            }}
          >
            Record adjustment
          </button>
          {hist.map((a) => (
            <div key={a.id} className="card">
              {fmt(a.from)} → {fmt(a.to)} · {a.who} · {a.why}
              <div className="muted">
                Tax effect Fed {moneySigned(a.federalEffect)} · CA {moneySigned(a.californiaEffect)}
              </div>
            </div>
          ))}
          <h3>Across versions</h3>
          {versions.map((x) => (
            <div key={x.v} className="muted">
              {x.v}: {fmt(x.val)}
            </div>
          ))}
          <h3>Related</h3>
          {related.map((k) => (
            <div key={k} className="claim" onClick={() => setClaim(k)}>
              <div className="mono">{k}</div>
              <div className="amt">{fmt(idx.lines.get(k)?.value)}</div>
            </div>
          ))}
          <button
            className="btn ghost"
            onClick={() =>
              dispatch({
                type: "judgment",
                j: {
                  id: uid(),
                  title: `Judgment on ${line.key}`,
                  area: areaForLine(line),
                  decision: why || "Accepted engine treatment",
                  authority: "Packet engine_reference + reviewer judgment",
                  who: work.roleId,
                  at: new Date().toISOString(),
                },
              })
            }
          >
            Record judgment
          </button>
        </>
      )}
    </div>
  );
}

function Tree({
  node,
  setClaim,
}: {
  node: NonNullable<ReturnType<typeof construction>>;
  setClaim: (k: string) => void;
}) {
  return (
    <div className="tree">
      <span className="claim" onClick={() => setClaim(node.key)}>
        {node.line.label} = {fmt(node.line.value)}
      </span>
      {node.children.map((c) =>
        c ? <Tree key={c.key} node={c} setClaim={setClaim} /> : null
      )}
    </div>
  );
}

function Indep({ line }: { line: Line }) {
  const { idx } = useWP();
  if (!idx) return null;
  if (line.rule === "R-SUM" && line.inputs?.length) {
    const s = line.inputs.reduce((a, k) => a + (num(idx.lines.get(k)?.value) || 0), 0);
    const v = num(line.value);
    const ok = v != null && Math.abs(v - s) < 1;
    return (
      <div className="card">
        Naive sum of inputs = {money(s)} vs line {money(v)}.{" "}
        {ok ? "Agrees." : "Does not agree — credits/signs may be implicit, or the engine is wrong."}
      </div>
    );
  }
  if (line.key === "F1040.1a") {
    return (
      <div className="card">
        Distinct W-2 box 1 (D08+D09, ignoring D10 duplicate) is the workpaper check.
        See investigation DUP_W2.
      </div>
    );
  }
  return (
    <div className="card muted">
      No extra arithmetic for this line. Trace sources and the rule instead.
    </div>
  );
}
