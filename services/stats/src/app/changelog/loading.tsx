import { ChangelogPage } from "@/components/changelog";
import { getLocale } from "@/lib/locale-server";

export default async function Loading() {
  return <ChangelogPage state={{ kind: "loading" }} locale={await getLocale()} />;
}
