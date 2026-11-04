"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, LoaderCircle, Send, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTestPush } from "@/actions/member";
import { cn } from "@/lib/utils";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const SW_URL = "/sw.js";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error(`Speichern fehlgeschlagen (${res.status})`);
}

async function detectStatus(): Promise<Status> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration("/");
  const sub = await registration?.pushManager.getSubscription();
  if (sub) {
    // Server-Stand auffrischen (falls das Abo dort gelöscht wurde)
    saveSubscription(sub).catch(() => undefined);
    return "on";
  }
  return "off";
}

function usePush(vapidKey: string | null) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    detectStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus("unsupported"));
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast.error("Benachrichtigungen wurden nicht erlaubt.");
        return;
      }
      await navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe(); // frisch mit aktuellem Server-Schlüssel abonnieren
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await saveSubscription(sub);
      setStatus("on");
      toast.success("Push-Benachrichtigungen sind auf diesem Gerät aktiv.");
    } catch (error) {
      console.error(error);
      toast.error("Aktivieren hat nicht geklappt. Bitte nochmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      toast.success("Push auf diesem Gerät ausgeschaltet.");
    } finally {
      setBusy(false);
    }
  }

  return { status, busy, enable, disable };
}

function IosInstallHint() {
  return (
    <p className="text-sm text-muted-foreground">
      Auf dem iPhone/iPad gehen Push-Benachrichtigungen nur aus der App heraus: In Safari unten auf{" "}
      <Share className="inline size-4 align-text-bottom" /> <b>Teilen</b> tippen → <SquarePlus className="inline size-4 align-text-bottom" />{" "}
      <b>Zum Home-Bildschirm</b>. Dann das Abi-Tool über das neue Symbol öffnen und hier aktivieren.
    </p>
  );
}

/** Ein-/Ausschalter mit Test-Button (Profil, Admin-Anleitung) */
export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const { status, busy, enable, disable } = usePush(vapidKey);
  const [testing, startTest] = useTransition();

  if (!vapidKey) {
    return <p className="text-sm text-muted-foreground">Push ist auf dem Server noch nicht eingerichtet (VAPID-Schlüssel fehlen).</p>;
  }

  switch (status) {
    case "loading":
      return <p className="text-sm text-muted-foreground">Prüfe Push-Status …</p>;
    case "unsupported":
      return <p className="text-sm text-muted-foreground">Dieser Browser unterstützt keine Push-Benachrichtigungen.</p>;
    case "ios-install":
      return <IosInstallHint />;
    case "denied":
      return (
        <p className="text-sm text-muted-foreground">
          Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser- bzw. Handy-Einstellungen und lade die Seite neu.
        </p>
      );
    case "off":
      return (
        <Button onClick={enable} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          Push auf diesem Gerät aktivieren
        </Button>
      );
    case "on":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
            <BellRing className="size-4" /> Aktiv auf diesem Gerät
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={testing}
            onClick={() =>
              startTest(async () => {
                const result = await sendTestPush();
                if (result?.error) toast.error(result.error);
                else toast.success(result?.message ?? "Gesendet");
              })
            }
          >
            {testing ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Test senden
          </Button>
          <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
            <BellOff className="size-4" /> Ausschalten
          </Button>
        </div>
      );
  }
}

// ---------------------------------------------------------------- Hinweis-Banner (Dashboard)

const DISMISS_KEY = "abi-tool:push-prompt-dismissed";
const DISMISS_EVENT = "abi-tool:push-prompt";

function subscribeDismissed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISS_EVENT, callback);
  };
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Banner "Push aktivieren?" – nur wenn möglich, noch nicht aktiv und nicht weggeklickt */
export function PushPrompt({ vapidKey, className }: { vapidKey: string | null; className?: string }) {
  const { status, busy, enable } = usePush(vapidKey);
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true);

  if (!vapidKey || dismissed || (status !== "off" && status !== "ios-install")) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ohne Speicher einfach nur für diese Sitzung ausblenden
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return (
    <div className={cn("flex gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4", className)}>
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold">Keine Schicht mehr verpassen</p>
        {status === "ios-install" ? (
          <IosInstallHint />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Aktiviere Push-Benachrichtigungen für Erinnerungen, neue Termine und Abstimmungen.
            </p>
            <div>
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <BellRing className="size-4" />} Aktivieren
              </Button>
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} className="self-start text-muted-foreground hover:text-foreground" aria-label="Ausblenden">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Registriert den Service Worker beim Laden (hält ihn aktuell, macht die App installierbar) */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    }
  }, []);
  return null;
}
