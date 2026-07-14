import { getRequestConfig } from "next-intl/server";

import { INTL_LOCALES } from "@/i18n/config";
import { getLocale } from "@/i18n/locale";
import { loadMessages } from "@/i18n/messages";

/**
 * Resolves the active locale (from the cookie) and its messages for every
 * server render. `next-intl` picks this up via the plugin in `next.config.ts`.
 */
export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    /*
     * The full BCP-47 tag, not the bare `"ar"` — it carries `-u-nu-latn`, which
     * is what stops the `#` inside an ICU plural rendering as Arabic-Indic
     * digits while every other number on the page is Latin. See `INTL_LOCALES`.
     * Consumers normalize it back with `normalizeLocale`.
     */
    locale: INTL_LOCALES[locale],
    messages: await loadMessages(locale),
    // The dataset is anchored to a fixed "today", and every timestamp in it is
    // a bare ISO date. Pinning the zone keeps server and client agreeing.
    timeZone: "Africa/Cairo",
  };
});
