"use server";

import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "@/i18n/config";

/** The locale for this request, from the cookie. Falls back to English. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Persist the language choice. The caller refreshes the router afterwards so
 * the server re-renders with the new messages and writing direction.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
}
