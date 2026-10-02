"use client";

import {
  Bell,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Inbox,
  Link2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Source = "Messenger" | "Instagram" | "Facebook" | "TikTok" | "Messages" | "Egyéb";
type Section = "messages" | "favorites" | "settings";

type Message = {
  item_id: string;
  sender: string | null;
  source: Source | string;
  title: string | null;
  subtitle: string | null;
  body: string;
  received_at: string;
  deep_link: string | null;
  unread: boolean;
  starred: boolean;
  calendar_status: "none" | "ignored" | "created" | "error";
  calendar_event_id: string | null;
  ai_summary: string | null;
};

const API = "https://syzpkrypgcwiyzzzlzzi.supabase.co/functions/v1/notification-center";
const sources: Source[] = ["Messenger", "Instagram", "Facebook", "TikTok", "Messages"];
const filters: Array<"Összes" | Source> = ["Összes", ...sources];

const sourceMeta: Record<string, { symbol: string; className: string }> = {
  Messenger: { symbol: "M", className: "messenger" },
  Instagram: { symbol: "◎", className: "instagram" },
  Facebook: { symbol: "f", className: "facebook" },
  TikTok: { symbol: "♪", className: "tiktok" },
  Messages: { symbol: "✉", className: "messages" },
  Egyéb: { symbol: "•", className: "other" },
};

function AppBadge({ source, small = false }: { source: string; small?: boolean }) {
  const meta = sourceMeta[source] || sourceMeta["Egyéb"];
  return <span className={`appBadge ${meta.className} ${small ? "small" : ""}`} aria-label={source}>{meta.symbol}</span>;
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "most";
  if (min < 60) return `${min} p`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ó`;
  if (h < 48) return "tegnap";
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

function initials(m: Message) {
  const s = (m.sender || m.title || m.source || "?").trim();
  return s.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("") || "?";
}

function makePersonalToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "nc_" + Array.from(bytes).map(x => x.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const [section, setSection] = useState<Section>("messages");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Összes");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [token, setToken] = useState("");
  const [pairInput, setPairInput] = useState("");
  const [paired, setPaired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [setupSource, setSetupSource] = useState<Source | null>(null);

  const callApi = useCallback(async (body: Record<string, unknown>, key?: string) => {
    const active = key || token;
    if (!active) throw new Error("Nincs párosítva.");
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-notification-token": active },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.message || `HTTP ${r.status}`);
    return d;
  }, [token]);

  const loadMessages = useCallback(async (key?: string) => {
    const active = key || token;
    if (!active) { setLoading(false); return; }
    setError("");
    try {
      const d = await callApi({ action: "list", limit: 150 }, active);
      setMessages(d.items || []);
      setPaired(true);
    } catch (e) {
      setPaired(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [callApi, token]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get("pair");
    if (incoming) {
      url.searchParams.delete("pair");
      history.replaceState({}, "", url.pathname + url.search + url.hash);
      setPairInput(incoming);
      void pairWithCode(incoming);
    } else {
      const saved = localStorage.getItem("notification-center-token") || "";
      if (saved) {
        setToken(saved);
        setPairInput(saved);
      } else {
        setLoading(false);
      }
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadMessages(token);
    const timer = window.setInterval(() => loadMessages(token), 30000);
    const onVisible = () => { if (document.visibilityState === "visible") loadMessages(token); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, loadMessages]);

  const visibleMessages = useMemo(() => messages.filter((m) => {
    if (section === "favorites" && !m.starred) return false;
    if (filter !== "Összes" && m.source !== filter) return false;
    const hay = `${m.sender || ""} ${m.title || ""} ${m.body} ${m.source}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  }), [messages, section, filter, query]);

  const unreadCount = messages.filter(m => m.unread).length;

  async function updateMessage(message: Message, patch: Partial<Pick<Message, "unread" | "starred">>) {
    setMessages(current => current.map(m => m.item_id === message.item_id ? { ...m, ...patch } : m));
    if (selected?.item_id === message.item_id) setSelected({ ...selected, ...patch });
    try { await callApi({ action: "update", id: message.item_id, ...patch }); }
    catch { await loadMessages(); }
  }

  function openMessage(message: Message) {
    setSelected(message);
    if (message.unread) updateMessage(message, { unread: false });
  }

  async function pairWithCode(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setLoading(true); setError("");
    try {
      const newToken = makePersonalToken();
      const r = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pair", pair_code: clean, new_token: newToken }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.message || "A párosítókód nem érvényes.");
      localStorage.setItem("notification-center-token", newToken);
      setToken(newToken); setPairInput(newToken); setPaired(true);
      setNotice("✓ iPhone párosítva. A személyes kulcs ezen az eszközön marad.");
      await loadMessages(newToken);
    } catch (e) {
      setPaired(false); setError(e instanceof Error ? e.message : String(e)); setLoading(false);
    }
  }

  async function pair() {
    const key = pairInput.trim();
    if (!key) return;
    if (key.startsWith("pair_")) { await pairWithCode(key); return; }
    setLoading(true); setError("");
    try {
      await callApi({ action: "status" }, key);
      localStorage.setItem("notification-center-token", key);
      setToken(key); setPaired(true); setNotice("✓ Párosítva az iPhone értesítési inboxszal.");
      await loadMessages(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setLoading(false);
    }
  }

  async function calendarRetry(message: Message) {
    setNotice("Naptár-ellenőrzés…");
    try {
      const d = await callApi({ action: "calendar_retry", id: message.item_id });
      setNotice(d.calendar_created ? "✓ Esemény bekerült a Naptárba." : "Nem találtam biztos naptári időpontot.");
      await loadMessages();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
  }

  async function testInbox() {
    try {
      const d = await callApi({
        action: "ingest",
        source: "Messenger",
        sender: "Értesítési Központ",
        title: "Kapcsolat teszt",
        message: "A Messenger értesítési híd működik. Ez nem naptáresemény.",
        received_at: new Date().toISOString(),
      });
      setNotice(d.calendar_created ? "✓ Teszt beérkezett és Naptár-eseményt is talált." : "✓ Teszt beérkezett az inboxba.");
      await loadMessages();
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)); }
  }

  async function testNotification() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotice("Ezen az eszközön ez a böngésző nem támogatja a webes értesítést."); return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setNotice("Az értesítési engedély nincs megadva."); return; }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Értesítési Központ", {
      body: "A saját PWA értesítés működik.",
      icon: "/icon.svg", badge: "/icon.svg", tag: "notification-center-test",
    });
    setNotice("Próbaértesítés elküldve.");
  }

  function shortcutConfig(source: Source) {
    const sourceName = source === "Messages" ? "Messages" : source;
    return [
      "ÉRTESÍTÉSI KÖZPONT · " + sourceName,
      "",
      "URL",
      API,
      "",
      "MÓDSZER",
      "POST",
      "",
      "FEJLÉC",
      "x-notification-token: " + token,
      "content-type: application/json",
      "",
      "JSON TÖRZS",
      "action = ingest",
      "source = " + sourceName,
      "sender = Értesítés címe / Notification Title",
      "subtitle = Értesítés alcíme / Notification Subtitle",
      "message = Értesítés üzenete / Notification Message",
      "received_at = Aktuális dátum / Current Date",
      "",
      "AUTOMATION",
      "Notification → alkalmazás: " + (source === "Messages" ? "Messages / Üzenetek" : source),
      "Futtatás: automatikusan / kérdezés nélkül",
    ].join("\n");
  }

  async function copyShortcut(source?: Source) {
    if (!token) return;
    const chosen = source || setupSource || "Messenger";
    try {
      await navigator.clipboard.writeText(shortcutConfig(chosen));
      setNotice("✓ " + (chosen === "Messages" ? "SMS / iMessage" : chosen) + " Shortcut-beállítás a vágólapon.");
    } catch {
      setNotice("A másolás nem sikerült. Nyisd meg ezt a képernyőt Safariban.");
    }
  }

  async function openShortcutSetup(source: Source) {
    setSetupSource(source);
    await copyShortcut(source);
    window.setTimeout(() => {
      window.location.href = "shortcuts://create-shortcut";
    }, 180);
  }

  function latestForSource(source: Source) {
    return messages
      .filter(m => m.source === source)
      .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())[0] || null;
  }

  function disconnect() {
    localStorage.removeItem("notification-center-token");
    setToken(""); setPairInput(""); setPaired(false); setMessages([]); setNotice("Párosítás törölve erről az eszközről.");
  }

  return (
    <main className="shell">
      <div className="phone">
        <header className="topBar">
          <div>
            <span className="eyebrow">SAJÁT KÖZPONT · ÉLŐ INBOX</span>
            <h1>{section === "messages" ? "Értesítési Központ" : section === "favorites" ? "Fontosak" : "Beállítások"}</h1>
          </div>
          {section !== "settings" ? (
            <button className="iconButton" onClick={() => setSection("settings")} aria-label="Beállítások"><Settings size={20} /></button>
          ) : (
            <button className="iconButton" onClick={() => setSection("messages")} aria-label="Vissza"><X size={20} /></button>
          )}
        </header>

        {!paired && !loading ? (
          <section className="pairPanel">
            <div className="pairIcon"><Link2 size={26} /></div>
            <span className="eyebrow">ELSŐ PÁROSÍTÁS</span>
            <h2>Kapcsold az iPhone-odhoz</h2>
            <p>A személyes kulcsot egyszer kell megadni. Utána az app és az iPhone Shortcut ugyanazt a privát inboxot használja.</p>
            <input value={pairInput} onChange={e => setPairInput(e.target.value)} placeholder="Személyes párosítókulcs" />
            <button className="primaryAction" onClick={pair}>Párosítás</button>
            {error && <div className="notice errorNotice">{error}</div>}
          </section>
        ) : section !== "settings" ? (
          <>
            <div className="sourceRail">
              {filters.map(item => {
                const count = item === "Összes" ? unreadCount : messages.filter(m => m.source === item && m.unread).length;
                return (
                  <button key={item} className={`sourceChip ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>
                    <span className="sourceIcon">{item === "Összes" ? <Inbox size={17} /> : <AppBadge source={item} small />}{count > 0 && <b>{count}</b>}</span>
                    <span>{item === "Messages" ? "SMS" : item}</span>
                  </button>
                );
              })}
            </div>

            <label className="searchBox">
              <Search size={18} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Keresés név vagy üzenet alapján" />
              {query && <button onClick={() => setQuery("")} aria-label="Törlés"><X size={16} /></button>}
            </label>

            <div className="listHeader">
              <span>{section === "favorites" ? "Kiemelt beszélgetések" : "Legutóbbiak"}</span>
              <button className="miniRefresh" onClick={() => loadMessages()} aria-label="Frissítés"><RefreshCw size={14} /> {visibleMessages.length}</button>
            </div>

            <section className="messageList">
              {loading && <div className="emptyState"><RefreshCw className="spin" size={26} /><strong>Szinkronizálás…</strong></div>}
              {!loading && visibleMessages.map(message => (
                <button className="messageRow" key={message.item_id} onClick={() => openMessage(message)}>
                  <div className="avatar initialsAvatar" aria-hidden="true">{initials(message)}</div>
                  <AppBadge source={message.source} small />
                  <div className="messageCopy">
                    <div className="messageTitle"><strong>{message.sender || message.title || message.source}</strong><time>{relativeTime(message.received_at)}</time></div>
                    <div className="messagePreview">
                      <span className={message.unread ? "unreadText" : ""}>{message.body}</span>
                      {message.calendar_status === "created" && <CalendarCheck2 className="calendarMini" size={15} />}
                      {message.unread && <i className="unreadDot" />}
                    </div>
                  </div>
                  <ChevronRight className="rowChevron" size={17} />
                </button>
              ))}
              {!loading && visibleMessages.length === 0 && (
                <div className="emptyState"><Bell size={28} /><strong>Még nincs beérkezett értesítés</strong><span>Az iPhone Shortcutból érkező üzenetek itt jelennek meg.</span></div>
              )}
            </section>
          </>
        ) : (
          <section className="settingsPanel">
            <div className="heroCard">
              <span className="heroIcon"><Smartphone size={24} /></span>
              <div><strong>{paired ? "iPhone kapcsolat aktív" : "Párosítás szükséges"}</strong><p>{paired ? "Az értesítések a saját privát inboxodba érkeznek, az időpontos üzenetek pedig automatikusan a Naptárba mehetnek." : "Nyisd meg a személyes párosítólinket ezen az iPhone-on."}</p></div>
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle"><SlidersHorizontal size={17} /><span>Értesítési híd</span></div>
              <button className="settingsRow" onClick={() => loadMessages()}><div><strong>Inbox frissítése</strong><span>Valós beérkező értesítések lekérése</span></div><RefreshCw size={18} /></button>
              <button className="settingsRow" onClick={testInbox}><div><strong>Bejövő kapcsolat tesztelése</strong><span>Biztonságos tesztüzenet az inboxba</span></div><ChevronRight size={18} /></button>
              <button className="settingsRow" onClick={() => copyShortcut()}><div><strong>Shortcut bekötés másolása</strong><span>URL + személyes kulcs + JSON minta</span></div><Copy size={18} /></button>
              <button className="settingsRow" onClick={testNotification}><div><strong>PWA próbaértesítés</strong><span>A saját app értesítésének ellenőrzése</span></div><Bell size={18} /></button>
              {notice && <div className="notice">{notice}</div>}
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle"><CalendarCheck2 size={17} /><span>Naptár kapcsolat</span></div>
              <div className="sourceStatus"><span className="calendarStatusIcon"><CalendarCheck2 size={18} /></span><div><strong>Automatikus eseményfelismerés</strong><span>Konkrét időpont / határidő → Naptár</span></div><Check size={17} /></div>
              <p className="iosNote">A Naptárba csak biztos esemény kerül. A like, reakció, fotó, általános csevegés és bizonytalan terv az inboxban marad.</p>
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle"><SlidersHorizontal size={17} /><span>iPhone automatizálás</span></div>
              <div className="shortcutIntro">
                <strong>Forrásonként egyszer kell bekötni.</strong>
                <span>A Beállítás gomb kimásolja a kész webhook-adatokat és rögtön megnyitja az új Shortcut szerkesztőt.</span>
              </div>
              {sources.map(source => {
                const latest = latestForSource(source);
                const label = source === "Messages" ? "SMS / iMessage" : source;
                return (
                  <div className="shortcutSource" key={source}>
                    <AppBadge source={source} />
                    <div className="shortcutSourceCopy">
                      <strong>{label}</strong>
                      <span className={latest ? "sourceLive" : ""}>
                        {latest ? "ÉLŐ · utolsó: " + relativeTime(latest.received_at) : "Még nem érkezett valós értesítés"}
                      </span>
                    </div>
                    <button onClick={() => openShortcutSetup(source)}>Beállítás</button>
                  </div>
                );
              })}
              {setupSource && (
                <div className="shortcutGuide">
                  <div className="shortcutGuideHead">
                    <AppBadge source={setupSource} small />
                    <strong>{setupSource === "Messages" ? "SMS / iMessage" : setupSource} bekötése</strong>
                  </div>
                  <ol>
                    <li>A Shortcutsban nevezd el: <b>Értesítés → {setupSource === "Messages" ? "SMS" : setupSource}</b>.</li>
                    <li><b>Edit → Automation → Notification</b>, majd válaszd ki a {setupSource === "Messages" ? "Messages / Üzenetek" : setupSource} appot.</li>
                    <li>Adj hozzá egy <b>Get Contents of URL / URL tartalmának lekérése</b> műveletet.</li>
                    <li>A vágólapról másold be az URL-t, a két fejlécet és a JSON mezőket. A Title / Subtitle / Message mezőkhöz az értesítés megfelelő változóit válaszd.</li>
                    <li>Állítsd <b>automatikus futásra, kérdezés nélkül</b>, majd mentsd el.</li>
                  </ol>
                  <div className="shortcutGuideActions">
                    <button onClick={() => copyShortcut(setupSource)}><Copy size={16} />Újra másolás</button>
                    <a href="shortcuts://create-shortcut">Shortcuts megnyitása</a>
                  </div>
                  <small>Ha megjön az első valódi értesítés, itt automatikusan ÉLŐ státuszt kapsz.</small>
                </div>
              )}
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle"><ShieldCheck size={17} /><span>Források</span></div>
              {sources.map(source => {
                const latest = latestForSource(source);
                return (
                  <div className="sourceStatus" key={source}>
                    <AppBadge source={source} />
                    <div><strong>{source === "Messages" ? "SMS / iMessage" : source}</strong><span>{latest ? "Kapcsolat bizonyítva · " + relativeTime(latest.received_at) : "iPhone értesítés → Shortcut → saját inbox"}</span></div>
                    {latest ? <Check size={17} /> : <span className="sourcePending">○</span>}
                  </div>
                );
              })}
              <p className="iosNote">Az app nem olvassa közvetlenül más alkalmazások privát adatbázisát. Az iPhone által átadott értesítési tartalmat fogadja a saját, személyes webhookon keresztül.</p>
            </div>

            <button className="disconnectButton" onClick={disconnect}>Párosítás törlése erről az eszközről</button>
          </section>
        )}

        <nav className="bottomNav">
          <button className={section === "messages" ? "active" : ""} onClick={() => setSection("messages")}><span className="navIconWrap"><Bell size={20} />{unreadCount > 0 && <b>{unreadCount}</b>}</span>Üzenetek</button>
          <button className={section === "favorites" ? "active" : ""} onClick={() => setSection("favorites")}><Star size={20} />Fontosak</button>
          <button className={section === "settings" ? "active" : ""} onClick={() => setSection("settings")}><Settings size={20} />Beállítások</button>
        </nav>

        {selected && (
          <div className="detailOverlay" role="dialog" aria-modal="true">
            <header className="detailHeader">
              <button className="backButton" onClick={() => setSelected(null)} aria-label="Vissza"><ChevronLeft size={23} /></button>
              <div className="detailSource"><AppBadge source={selected.source} small /><div><strong>{selected.sender || selected.title || selected.source}</strong><span>{selected.source}</span></div></div>
              <button className={`starButton ${selected.starred ? "active" : ""}`} onClick={() => updateMessage(selected, { starred: !selected.starred })} aria-label="Fontos"><Star size={21} fill={selected.starred ? "currentColor" : "none"} /></button>
            </header>
            <div className="detailBody">
              <div className="detailAvatar initialsAvatar">{initials(selected)}</div>
              <h2>{selected.sender || selected.title || selected.source}</h2>
              <span className="detailLabel">{selected.source} · {new Date(selected.received_at).toLocaleString("hu-HU")}</span>
              <div className="bubble">{selected.body}</div>
              {selected.subtitle && <span className="detailTime">{selected.subtitle}</span>}
              <div className={`calendarResult ${selected.calendar_status}`}>
                <CalendarCheck2 size={18} />
                <span>{selected.calendar_status === "created" ? "Felismert esemény · bekerült a Naptárba" : selected.calendar_status === "error" ? "Az automatikus felismerés hibázott" : "Nem került automatikusan a Naptárba"}</span>
              </div>
              {selected.ai_summary && <p className="aiSummary">{selected.ai_summary}</p>}
              {selected.calendar_status !== "created" && <button className="secondaryAction" onClick={() => calendarRetry(selected)}><CalendarCheck2 size={18} />Naptár újraellenőrzése</button>}
              {selected.deep_link && <a className="openButton" href={selected.deep_link} target="_blank" rel="noreferrer"><ExternalLink size={18} />Megnyitás: {selected.source}</a>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
