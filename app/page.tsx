"use client";

import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Source = "Messenger" | "Instagram" | "Facebook" | "TikTok";
type Section = "messages" | "favorites" | "settings";

type Message = {
  id: number;
  name: string;
  source: Source;
  text: string;
  time: string;
  avatar: string;
  deepLink: string;
  unread: boolean;
  starred: boolean;
};

const messages: Message[] = [
  {
    id: 1,
    name: "Kovács Anna",
    source: "Messenger",
    text: "Szia! Hogy vagy? 😊",
    time: "most",
    avatar: "https://i.pravatar.cc/160?img=47",
    deepLink: "https://www.messenger.com/",
    unread: true,
    starred: true,
  },
  {
    id: 2,
    name: "Balázs",
    source: "Instagram",
    text: "Reagált a sztoridra: ❤️",
    time: "2 p",
    avatar: "https://i.pravatar.cc/160?img=12",
    deepLink: "https://www.instagram.com/direct/inbox/",
    unread: true,
    starred: false,
  },
  {
    id: 3,
    name: "Tóth Gábor",
    source: "Facebook",
    text: "Üzenetet küldött.",
    time: "5 p",
    avatar: "https://i.pravatar.cc/160?img=11",
    deepLink: "https://www.facebook.com/messages/",
    unread: true,
    starred: true,
  },
  {
    id: 4,
    name: "Lili",
    source: "TikTok",
    text: "Új üzenet: Szia! 👋",
    time: "10 p",
    avatar: "https://i.pravatar.cc/160?img=32",
    deepLink: "https://www.tiktok.com/messages",
    unread: true,
    starred: false,
  },
  {
    id: 5,
    name: "Dávid",
    source: "Messenger",
    text: "Holnap találkozunk?",
    time: "12 p",
    avatar: "https://i.pravatar.cc/160?img=13",
    deepLink: "https://www.messenger.com/",
    unread: false,
    starred: false,
  },
  {
    id: 6,
    name: "Eszter",
    source: "Instagram",
    text: "Küldött egy fotót.",
    time: "15 p",
    avatar: "https://i.pravatar.cc/160?img=25",
    deepLink: "https://www.instagram.com/direct/inbox/",
    unread: false,
    starred: true,
  },
];

const sourceMeta: Record<Source, { symbol: string; className: string }> = {
  Messenger: { symbol: "M", className: "messenger" },
  Instagram: { symbol: "◎", className: "instagram" },
  Facebook: { symbol: "f", className: "facebook" },
  TikTok: { symbol: "♪", className: "tiktok" },
};

const filters: Array<"Összes" | Source> = [
  "Összes",
  "Messenger",
  "Instagram",
  "Facebook",
  "TikTok",
];

function AppBadge({ source, small = false }: { source: Source; small?: boolean }) {
  const meta = sourceMeta[source];
  return (
    <span
      className={`appBadge ${meta.className} ${small ? "small" : ""}`}
      aria-label={source}
    >
      {meta.symbol}
    </span>
  );
}

export default function Home() {
  const [section, setSection] = useState<Section>("messages");
  const [filter, setFilter] = useState<(typeof filters)[number]>("Összes");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const [readIds, setReadIds] = useState<number[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    const read = localStorage.getItem("notification-center-read");
    const favorites = localStorage.getItem("notification-center-favorites");
    if (read) setReadIds(JSON.parse(read));
    if (favorites) setFavoriteIds(JSON.parse(favorites));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("notification-center-read", JSON.stringify(readIds));
  }, [readIds]);

  useEffect(() => {
    localStorage.setItem(
      "notification-center-favorites",
      JSON.stringify(favoriteIds),
    );
  }, [favoriteIds]);

  const isRead = (message: Message) =>
    readIds.includes(message.id) || !message.unread;

  const isFavorite = (message: Message) =>
    favoriteIds.includes(message.id) ||
    (message.starred && !favoriteIds.includes(-message.id));

  const visibleMessages = useMemo(() => {
    return messages.filter((message) => {
      if (section === "favorites" && !isFavorite(message)) return false;
      if (filter !== "Összes" && message.source !== filter) return false;
      const haystack = `${message.name} ${message.text} ${message.source}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [filter, query, section, favoriteIds]);

  const unreadCount = messages.filter((m) => !isRead(m)).length;

  function openMessage(message: Message) {
    setSelected(message);
    if (!readIds.includes(message.id)) {
      setReadIds((current) => [...current, message.id]);
    }
  }

  function toggleFavorite(message: Message) {
    setFavoriteIds((current) => {
      const active = isFavorite(message);
      if (active) {
        if (message.starred && !current.includes(-message.id)) {
          return [...current.filter((id) => id !== message.id), -message.id];
        }
        return current.filter((id) => id !== message.id);
      }
      return [...current.filter((id) => id !== -message.id), message.id];
    });
  }

  async function testNotification() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotice("Ezen az eszközön ez a böngésző nem támogatja a webes értesítést.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotice("Az értesítési engedély nincs megadva.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Értesítési Központ", {
      body: "A saját értesítéseid működnek. Ez egy próbaüzenet.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "notification-center-test",
    });
    setNotice("Próbaértesítés elküldve.");
  }

  return (
    <main className="shell">
      <div className="phone">
        <header className="topBar">
          <div>
            <span className="eyebrow">SAJÁT KÖZPONT</span>
            <h1>
              {section === "messages"
                ? "Értesítési Központ"
                : section === "favorites"
                  ? "Fontosak"
                  : "Beállítások"}
            </h1>
          </div>
          {section !== "settings" ? (
            <button
              className="iconButton"
              onClick={() => setSection("settings")}
              aria-label="Beállítások"
            >
              <Settings size={20} />
            </button>
          ) : (
            <button
              className="iconButton"
              onClick={() => setSection("messages")}
              aria-label="Vissza"
            >
              <X size={20} />
            </button>
          )}
        </header>

        {section !== "settings" ? (
          <>
            <div className="sourceRail">
              {filters.map((item) => {
                const count =
                  item === "Összes"
                    ? unreadCount
                    : messages.filter(
                        (m) => m.source === item && !isRead(m),
                      ).length;
                return (
                  <button
                    key={item}
                    className={`sourceChip ${filter === item ? "active" : ""}`}
                    onClick={() => setFilter(item)}
                  >
                    <span className="sourceIcon">
                      {item === "Összes" ? (
                        <Inbox size={17} />
                      ) : (
                        <AppBadge source={item} small />
                      )}
                      {count > 0 && <b>{count}</b>}
                    </span>
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>

            <label className="searchBox">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Keresés név vagy üzenet alapján"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Törlés">
                  <X size={16} />
                </button>
              )}
            </label>

            <div className="listHeader">
              <span>
                {section === "favorites" ? "Kiemelt beszélgetések" : "Legutóbbiak"}
              </span>
              <span className="muted">{visibleMessages.length} elem</span>
            </div>

            <section className="messageList">
              {visibleMessages.map((message) => (
                <button
                  className="messageRow"
                  key={message.id}
                  onClick={() => openMessage(message)}
                >
                  <div
                    className="avatar"
                    style={{ backgroundImage: `url("${message.avatar}")` }}
                    aria-hidden="true"
                  />
                  <AppBadge source={message.source} small />
                  <div className="messageCopy">
                    <div className="messageTitle">
                      <strong>{message.name}</strong>
                      <time>{message.time}</time>
                    </div>
                    <div className="messagePreview">
                      <span className={!isRead(message) ? "unreadText" : ""}>
                        {message.text}
                      </span>
                      {!isRead(message) && <i className="unreadDot" />}
                    </div>
                  </div>
                  <ChevronRight className="rowChevron" size={17} />
                </button>
              ))}

              {visibleMessages.length === 0 && (
                <div className="emptyState">
                  <Search size={28} />
                  <strong>Nincs találat</strong>
                  <span>Próbálj másik keresést vagy szűrőt.</span>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="settingsPanel">
            <div className="heroCard">
              <span className="heroIcon">
                <Bell size={24} />
              </span>
              <div>
                <strong>iPhone-ra optimalizálva</strong>
                <p>
                  Add hozzá a Főképernyőhöz, és önálló alkalmazásként fog
                  megnyílni.
                </p>
              </div>
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle">
                <SlidersHorizontal size={17} />
                <span>Értesítések</span>
              </div>
              <button className="settingsRow" onClick={testNotification}>
                <div>
                  <strong>Próbaértesítés küldése</strong>
                  <span>A saját PWA értesítésének ellenőrzése</span>
                </div>
                <ChevronRight size={18} />
              </button>
              {notice && <div className="notice">{notice}</div>}
            </div>

            <div className="settingsGroup">
              <div className="settingsTitle">
                <ShieldCheck size={17} />
                <span>Források</span>
              </div>
              {(["Messenger", "Instagram", "Facebook", "TikTok"] as Source[]).map(
                (source) => (
                  <div className="sourceStatus" key={source}>
                    <AppBadge source={source} />
                    <div>
                      <strong>{source}</strong>
                      <span>Megnyitási kapcsolat kész</span>
                    </div>
                    <Check size={17} />
                  </div>
                ),
              )}
              <p className="iosNote">
                iOS nem engedi, hogy egy alkalmazás közvetlenül kiolvassa más
                appok rendszerértesítéseit. A központ ezért külön
                forráscsatlakozókra épül; csak ténylegesen elérhető adatot fogunk
                megjeleníteni.
              </p>
            </div>
          </section>
        )}

        <nav className="bottomNav">
          <button
            className={section === "messages" ? "active" : ""}
            onClick={() => setSection("messages")}
          >
            <span className="navIconWrap">
              <Bell size={20} />
              {unreadCount > 0 && <b>{unreadCount}</b>}
            </span>
            Üzenetek
          </button>
          <button
            className={section === "favorites" ? "active" : ""}
            onClick={() => setSection("favorites")}
          >
            <Star size={20} />
            Fontosak
          </button>
          <button
            className={section === "settings" ? "active" : ""}
            onClick={() => setSection("settings")}
          >
            <Settings size={20} />
            Beállítások
          </button>
        </nav>

        {selected && (
          <div className="detailOverlay" role="dialog" aria-modal="true">
            <header className="detailHeader">
              <button
                className="backButton"
                onClick={() => setSelected(null)}
                aria-label="Vissza"
              >
                <ChevronLeft size={23} />
              </button>
              <div className="detailSource">
                <AppBadge source={selected.source} small />
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.source}</span>
                </div>
              </div>
              <button
                className={`starButton ${isFavorite(selected) ? "active" : ""}`}
                onClick={() => toggleFavorite(selected)}
                aria-label="Fontos"
              >
                <Star size={21} fill={isFavorite(selected) ? "currentColor" : "none"} />
              </button>
            </header>

            <div className="detailBody">
              <div
                className="detailAvatar"
                style={{ backgroundImage: `url("${selected.avatar}")` }}
              />
              <h2>{selected.name}</h2>
              <span className="detailLabel">{selected.source}</span>

              <div className="bubble">{selected.text}</div>
              <span className="detailTime">{selected.time}</span>

              <a
                className="openButton"
                href={selected.deepLink}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={18} />
                Megnyitás: {selected.source}
              </a>
              <p className="deepLinkHint">
                iPhone-on a rendszer az adott szolgáltatás alkalmazását nyitja
                meg, ha az telepítve van és a szolgáltatás támogatja az
                univerzális hivatkozást.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
