"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/locale";

/** Below the root layout, so top bar, footer and the chosen language stay. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <main className="container content">
      <div className="notice">
        <span className="icon-tile" aria-hidden>
          <TriangleAlert />
        </span>
        <div className="intro">
          <h1>{t.error.title}</h1>
          <p>{t.error.text}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={reset}>
          <RotateCw aria-hidden />
          {t.error.retry}
        </button>
      </div>
    </main>
  );
}
