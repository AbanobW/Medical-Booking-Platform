import type { Locale } from "@/i18n/config";

/**
 * Messages are split one file per namespace, under `messages/<locale>/`.
 *
 * A single monolithic `en.json` becomes a merge-conflict magnet the moment more
 * than one person touches it; a file per namespace keeps ownership obvious. The
 * files are merged back into the one object `next-intl` expects, so call sites
 * still say `useTranslations("booking")`.
 */
export const NAMESPACES = [
  "common",
  "nav",
  "auth",
  "home",
  "search",
  "profile",
  "booking",
  "patient",
  "provider",
  "admin",
  "domain",
  "errors",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

type MessageTree = Record<string, unknown>;

export async function loadMessages(
  locale: Locale,
): Promise<Record<string, MessageTree>> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = (await import(`../../messages/${locale}/${ns}.json`)) as {
        default: MessageTree;
      };
      return [ns, mod.default] as const;
    }),
  );

  return Object.fromEntries(entries);
}
