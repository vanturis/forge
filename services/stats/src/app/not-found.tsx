import { ArrowLeft, Compass } from "lucide-react";
import { localePath } from "@/lib/i18n";
import { getRoute } from "@/lib/locale-server";
import { i18n } from "@/lib/messages";

export default async function NotFound() {
  const { locale, base } = await getRoute();
  const { t } = i18n(locale);
  return (
    <main className="container content">
      <div className="notice">
        <span className="icon-tile" aria-hidden>
          <Compass />
        </span>
        <div className="intro">
          <h1>{t.notFound.title}</h1>
          <p>{t.notFound.text}</p>
        </div>
        <a className="btn btn-primary" href={localePath("/", base)}>
          <ArrowLeft aria-hidden />
          {t.notFound.back}
        </a>
      </div>
    </main>
  );
}
