"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminGet } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
type Row = Record<string, any>;
const TABS = ["contacts", "leads", "viewings", "calls", "listings"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { contacts: "Registered callers", leads: "Leads", viewings: "Viewings", calls: "Calls", listings: "Listings" };
const COLS: Record<Tab, [string, string][]> = {
  contacts: [["created_at", "When"], ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["intent", "Wants"], ["summary", "Summary"], ["email_status", "Team email"]],
  leads: [["created_at", "When"], ["name", "Name"], ["phone", "Phone"], ["intent", "Wants"], ["area", "Area"], ["budget", "Budget (AED)"], ["bedrooms", "Beds"], ["timeline", "Timeline"], ["tier", "Tier"], ["score", "Score"]],
  viewings: [["date", "Date"], ["time", "Time (GST)"], ["title", "Property"], ["name", "Name"], ["phone", "Phone"]],
  calls: [["started_at", "Started"], ["status", "Status"], ["end_reason", "Ended by"], ["summary", "Summary"]],
  listings: [["title", "Property"], ["listing_type", "Type"], ["price_label", "Price"], ["bedrooms", "Beds"], ["permit_valid", "Permit valid"]],
};

function cell(k: string, v: any) {
  if (v === null || v === undefined || v === "") return <span style={{ opacity: 0.4 }}>-</span>;
  if (k === "tier" || k === "email_status" || k === "status") return <span className={`tag ${String(v).toLowerCase()}`}>{String(v).replace("_", " ")}</span>;
  if (k === "budget") return Number(v).toLocaleString();
  if (k === "permit_valid") return v ? "Yes" : "Expired";
  if (k.endsWith("_at") && typeof v === "string") return new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return String(v);
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>("contacts");
  const [data, setData] = useState<Record<Tab, Row[]>>({ contacts: [], leads: [], viewings: [], calls: [], listings: [] });
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [turns, setTurns] = useState<Row[]>([]);

  useEffect(() => {
    try { setToken(sessionStorage.getItem("admin") || ""); } catch { setToken(""); }
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [contacts, leads, viewings, calls, listings] = await Promise.all(
        TABS.map((t) => adminGet<Row[]>(`/api/${t}`, token))
      );
      setData({ contacts, leads, viewings, calls, listings });
      setErr("");
    } catch (e) {
      if (e instanceof Error && e.message === "auth") {
        try { sessionStorage.removeItem("admin"); } catch {}
        setToken("");
        setErr("That admin token was not accepted.");
      } else setErr("Cannot reach the backend. Check that it is running.");
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const toggleCall = async (id: string) => {
    if (open === id) return setOpen(null);
    setOpen(id);
    try { setTurns(await adminGet<Row[]>(`/api/calls/${id}/turns`, token!)); } catch { setTurns([]); }
  };

  if (token === null) return null;
  if (!token)
    return (
      <main className="dash">
        <form className="gate" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem("admin", draft); } catch {} setToken(draft); }}>
          <h1>Team dashboard</h1>
          <input type="password" placeholder="Admin token" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Admin token" autoFocus />
          {err && <p className="err">{err}</p>}
          <button className="call" style={{ animation: "none", marginTop: 6 }}>Open dashboard</button>
        </form>
      </main>
    );

  const hot = data.leads.filter((l) => l.tier === "hot").length;
  const rows = data[tab];
  return (
    <main className="dash">
      <div className="dash-top">
        <h1>Skyline Properties, team dashboard</h1>
        <Link className="ghost" href="/">Back to call page</Link>
      </div>
      {err && <p className="err">{err}</p>}
      <div className="stats">
        <div className="stat"><b>{data.calls.length}</b><span>Calls</span></div>
        <div className="stat"><b>{data.contacts.length}</b><span>Registered callers</span></div>
        <div className="stat"><b>{data.leads.length}</b><span>Leads</span></div>
        <div className="stat"><b>{hot}</b><span>Hot leads</span></div>
        <div className="stat"><b>{data.viewings.length}</b><span>Viewings booked</span></div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>{LABEL[t]}</button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr>{COLS[tab].map(([k, h]) => <th key={k}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={COLS[tab].length} style={{ color: "var(--haze)" }}>Nothing here yet. Make a call and it will appear.</td></tr>}
            {rows.map((r, i) => (
              <>
                <tr key={i} className={tab === "calls" ? "click" : ""} onClick={tab === "calls" ? () => toggleCall(r.call_id) : undefined}>
                  {COLS[tab].map(([k]) => <td key={k}>{cell(k, r[k])}</td>)}
                </tr>
                {tab === "calls" && open === r.call_id && (
                  <tr key={`${i}-t`}><td colSpan={COLS[tab].length}><div className="turns">
                    {turns.length === 0 && <span style={{ color: "var(--haze)" }}>No transcript saved for this call.</span>}
                    {turns.map((t) => <p key={t.id}><b>{t.role === "user" ? "Caller" : "Aria"}:</b> {t.text}</p>)}
                  </div></td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
