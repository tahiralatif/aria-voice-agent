"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Skyline from "./Skyline";
import { CallEngine, type Role } from "@/lib/callEngine";
import { createSession, fetchActivity, type ActivityEvent } from "@/lib/api";

type Status = "idle" | "connecting" | "live" | "ended" | "error";
type Line = { key: string; role: Role; text: string; live: boolean; interrupted?: boolean };

const KIND_LABEL: Record<string, string> = {
  search: "Searching listings",
  availability: "Checking viewing times",
  booking: "Viewing booked",
  lead: "Lead saved",
  web: "Quick web search",
  register: "Caller registered",
  email: "Team emailed",
};

export default function CallStage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [secs, setSecs] = useState(0);
  const engine = useRef<CallEngine | null>(null);
  const lastId = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const getLevels = useCallback(() => engine.current?.levels() ?? { mic: 0, out: 0 }, []);

  const upsert = useCallback((turn: number, role: Role, fn: (l?: Line) => Partial<Line>) => {
    const key = `${turn}-${role}`;
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i === -1) return [...prev, { key, role, text: "", live: true, ...fn() }];
      const next = prev.slice();
      next[i] = { ...next[i], ...fn(next[i]) };
      return next;
    });
  }, []);

  const start = async () => {
    setError("");
    setLines([]);
    setEvents([]);
    setSecs(0);
    try {
      const base = await fetchActivity(null).catch(() => null);
      lastId.current = base ? base.last_id : null;
      const session = await createSession();
      const e = new CallEngine({
        onStatus: (s, d) => {
          setStatus(s);
          if (s === "error") setError(d ?? "Something went wrong.");
        },
        onTurnStart: (turn, role) => upsert(turn, role, () => ({})),
        onDelta: (turn, role, text) => upsert(turn, role, (l) => ({ text: (l?.text ?? "") + text })),
        onTurnEnd: (turn, role, text, interrupted) =>
          upsert(turn, role, (l) => ({ text: text || l?.text || "", live: false, interrupted })),
      });
      engine.current = e;
      setStatus("connecting");
      await e.start(session);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Something went wrong.";
      setError(
        /Permission|NotAllowed|denied/i.test(m)
          ? "Microphone is blocked. Allow it in the address bar and try again."
          : m
      );
      setStatus("error");
    }
  };

  const hangUp = () => engine.current?.hangUp();

  // activity feed
  useEffect(() => {
    if (status !== "live" && status !== "connecting") return;
    const id = setInterval(async () => {
      if (lastId.current === null) return;
      try {
        const r = await fetchActivity(lastId.current);
        if (r.events.length) {
          lastId.current = r.last_id;
          setEvents((p) => [...p, ...r.events]);
        }
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => () => engine.current?.hangUp(), []);

  const live = status === "live";
  const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <main className="stage">
      <Skyline getLevels={getLevels} live={live} />
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Skyline Properties
        </div>
        <a className="ghost" href="/dashboard">Team dashboard</a>
      </header>

      <section className="hero" aria-live="polite">
        {status === "idle" || status === "ended" || status === "error" ? (
          <>
            <h1>
              {status === "ended" ? "Call ended." : "Property questions at any hour."}
            </h1>
            <p className="sub">
              {status === "ended"
                ? "Everything Aria learned is saved for the team. Call again or open the dashboard."
                : "Talk to Aria, our AI assistant for Dubai homes. She finds listings, books viewings and passes your details to an agent."}
            </p>
            {error && <p className="err" role="alert">{error}</p>}
            <button className="call" onClick={start}>
              {status === "ended" ? "Call again" : "Talk to Aria"}
            </button>
            <p className="fine">Uses your microphone. Headphones give the best sound. Calls may be recorded.</p>
          </>
        ) : (
          <div className="live-head">
            <span className={`dot ${live ? "on" : ""}`} />
            <span>{live ? `Live with Aria  ${clock}` : "Connecting…"}</span>
            <button className="end" onClick={hangUp}>End call</button>
          </div>
        )}
      </section>

      {(live || lines.length > 0 || events.length > 0) && status !== "idle" && (
        <aside className="panel">
          <div className="col">
            <h2>Conversation</h2>
            <div className="scroll" ref={scroller}>
              {lines.length === 0 && <p className="empty">Say hello. Aria is listening.</p>}
              {lines.map((l) => (
                <p key={l.key} className={`bubble ${l.role}`}>
                  <span className="who">{l.role === "user" ? "You" : "Aria"}</span>
                  {l.text || "…"}
                  {l.live && <i className="caret" />}
                </p>
              ))}
            </div>
          </div>
          <div className="col">
            <h2>What Aria is doing</h2>
            <div className="scroll">
              {events.length === 0 && <p className="empty">Searches, bookings and saved details appear here.</p>}
              {events.map((ev) => (
                <article key={ev.id} className={`ev ${ev.kind}`}>
                  <div className="ev-title">{KIND_LABEL[ev.kind] ?? ev.kind}</div>
                  <div className="ev-text">{ev.text}</div>
                  {ev.data?.listings?.map((x, i) => (
                    <div className="listing" key={i}>
                      <strong>{x.title}</strong>
                      <span>{typeof x.price === "number" ? `AED ${x.price.toLocaleString()}` : x.price}</span>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </div>
        </aside>
      )}
    </main>
  );
}
