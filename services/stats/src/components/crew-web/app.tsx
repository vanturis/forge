"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import logo from "@/assets/forge-wordmark.png";
import { CrewWebClient } from "@/lib/crew-web/client";
import { supported } from "@/lib/crew-web/crypto";
import { crewMessages, type CrewMessages } from "@/lib/crew-web/messages";
import { decodeInvite } from "@/lib/crew-web/wire";
import { localePath } from "@/lib/i18n";
import { LanguageSwitch, useI18n, useLocaleBase } from "../locale";
import { CrewBoard } from "./crew-view";
import { ClosedCard, JoinForm, PendingCard } from "./join";
import { useCrew } from "./util";

/**
 * The crew in the browser: the crews of this browser (localStorage), joining with an invite from the
 * link's #, and the board of the chosen crew. Everything runs here; the server only relays sealed bytes.
 */
export function CrewApp() {
  const { locale } = useI18n();
  const m = crewMessages(locale);
  const [clients, setClients] = useState<CrewWebClient[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const live = useRef<CrewWebClient[]>([]);

  useEffect(() => {
    const list = CrewWebClient.list();
    live.current = list;
    for (const c of list) c.start();
    // The invite in the link (…/crew#forge-crew1.…) is read once and taken out of the address bar.
    let fromHash = window.location.hash.slice(1);
    try {
      fromHash = decodeURIComponent(fromHash);
    } catch {
      // Not percent-encoded: taken as it is.
    }
    const invite = decodeInvite(fromHash);
    if (invite) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      const known = list.find((c) => c.roomId === invite.r && c.view().membership !== "rejected" && c.view().membership !== "removed");
      if (known) setActive(known.id);
      else {
        setCode(fromHash);
        setAdding(true);
      }
    }
    setActive((cur) => cur ?? list[0]?.id ?? null);
    setClients(list);
    void supported().then(setOk);
    const wake = () => {
      if (document.visibilityState === "visible") for (const c of live.current) c.wake();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      for (const c of live.current) c.stop();
    };
  }, []);

  const joined = useCallback((c: CrewWebClient) => {
    c.start();
    live.current = [...live.current.filter((x) => x.id !== c.id), c];
    setClients(live.current);
    setActive(c.id);
    setAdding(false);
    setCode("");
  }, []);

  const gone = useCallback((id: string) => {
    live.current = live.current.filter((x) => x.id !== id);
    setClients(live.current);
    setActive(live.current[0]?.id ?? null);
  }, []);

  if (clients === null) {
    return (
      <Shell
        m={m}
        nav={
          <div className="crew-nav" aria-hidden>
            <span className="crew-nav-item skeleton-bar" />
          </div>
        }
      >
        <BoardSkeleton label={m.loading} />
      </Shell>
    );
  }

  const current = clients.find((c) => c.id === active) ?? null;
  const showJoin = adding || !current;

  return (
    <Shell
      m={m}
      nav={
        <nav className="crew-nav" aria-label={m.crews}>
          {clients.map((c) => (
            <CrewChip key={c.id} client={c} on={!showJoin && c.id === current?.id} onClick={() => (setActive(c.id), setAdding(false))} />
          ))}
          <button type="button" className="crew-nav-item" aria-pressed={showJoin} onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            <span className="crew-ellipsis">{clients.length ? m.addCrew : m.joinTitle}</span>
          </button>
        </nav>
      }
    >
      {ok === false ? (
        <div className="crew-scroll">
          <div className="crew-card crew-pending">
            <AlertTriangle aria-hidden className="crew-warn-icon" />
            <p>{m.unsupported}</p>
          </div>
        </div>
      ) : showJoin ? (
        <div className="crew-scroll">
          <div className="crew-intro">
            {!clients.length && (
              <div className="intro">
                <h1>{m.title}</h1>
                <p>{m.lead}</p>
              </div>
            )}
            <JoinForm initialCode={code} joinedRooms={clients.filter((c) => c.view().membership !== "rejected" && c.view().membership !== "removed").map((c) => c.roomId)} onJoined={joined} onCancel={clients.length ? () => setAdding(false) : null} />
          </div>
        </div>
      ) : (
        <CrewScreen key={current.id} client={current} onGone={() => gone(current.id)} />
      )}
    </Shell>
  );
}

/** The window of the app view: the sidebar with wordmark, crews and language, next to it the main area. */
function Shell({ m, nav, children }: { m: CrewMessages; nav: ReactNode; children: ReactNode }) {
  const { t } = useI18n();
  const base = useLocaleBase();
  return (
    <div className="crew-shell">
      <aside className="crew-side" aria-label={m.crews}>
        <a href={localePath("/", base)} className="crew-logo" aria-label={t.header.home}>
          <img src={logo.src} width={144} height={28} alt="" />
        </a>
        <div className="crew-side-nav">
          <p className="crew-side-heading" aria-hidden>
            {m.crews}
          </p>
          {nav}
        </div>
        <div className="crew-side-foot">
          <LanguageSwitch />
        </div>
      </aside>
      <div className="crew-main">{children}</div>
    </div>
  );
}

function CrewChip({ client, on, onClick }: { client: CrewWebClient; on: boolean; onClick: () => void }) {
  const crew = useCrew(client);
  return (
    <button type="button" className="crew-nav-item" aria-pressed={on} onClick={onClick}>
      <span className={crew.connection === "online" ? "live-dot live-dot-on" : "live-dot"} aria-hidden />
      <span className="crew-ellipsis">{crew.name}</span>
    </button>
  );
}

function CrewScreen({ client, onGone }: { client: CrewWebClient; onGone: () => void }) {
  const crew = useCrew(client);
  if (crew.membership === "pending")
    return (
      <div className="crew-scroll">
        <PendingCard
          crew={crew}
          onCancel={() => {
            client.forget();
            onGone();
          }}
        />
      </div>
    );
  if (crew.membership === "rejected" || crew.membership === "removed")
    return (
      <div className="crew-scroll">
        <ClosedCard
          crew={crew}
          onForget={() => {
            client.forget();
            onGone();
          }}
        />
      </div>
    );
  return <CrewBoard client={client} crew={crew} onLeft={onGone} />;
}

/** The board's shape while the crews load from this browser. */
function BoardSkeleton({ label }: { label: string }) {
  return (
    <div className="crew-board crew-skeleton" data-tab="chat" aria-busy="true" aria-label={label}>
      <div className="crew-board-head">
        <div className="crew-board-title">
          <span className="skeleton-bar crew-sk-title" />
          <span className="skeleton-bar crew-sk-sub" />
        </div>
      </div>
      <div className="crew-tabs">
        <span className="skeleton-bar crew-sk-tab" />
        <span className="skeleton-bar crew-sk-tab" />
        <span className="skeleton-bar crew-sk-tab" />
      </div>
      <div className="crew-columns">
        <div className="crew-col crew-col-people">
          <div className="crew-col-title">
            <span className="skeleton-bar crew-sk-sub" />
          </div>
          <div className="crew-col-body crew-people">
            <span className="skeleton-bar crew-sk-card" />
            <span className="skeleton-bar crew-sk-card" />
          </div>
        </div>
        <div className="crew-col crew-col-chat">
          <div className="crew-col-title">
            <span className="skeleton-bar crew-sk-sub" />
          </div>
          <div className="crew-col-body">
            <div className="crew-feed">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="crew-feed-item">
                  <span className="skeleton-bar crew-sk-avatar" />
                  <div className="crew-feed-body">
                    <span className="skeleton-bar crew-sk-sub" />
                    <span className="skeleton-bar crew-sk-line" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="crew-col crew-col-tasks">
          <div className="crew-col-title">
            <span className="skeleton-bar crew-sk-sub" />
          </div>
          <div className="crew-col-body crew-people">
            <span className="skeleton-bar crew-sk-card" />
            <span className="skeleton-bar crew-sk-card" />
          </div>
        </div>
      </div>
    </div>
  );
}
