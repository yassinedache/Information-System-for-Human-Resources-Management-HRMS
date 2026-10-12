/* Interface language (French by default, English) and formatting of dates, months and amounts. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setApiLanguage } from "./api.js";
import { messages } from "./locales.js";

const I18n = createContext(null);
const LANGS = ["fr", "en"];

function initialLang() {
  try {
    const saved = localStorage.getItem("hrms-lang");
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return (navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

/** "2026-10-12" -> local Date (no time-zone shift) */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d || 1);
}

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  setApiLanguage(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem("hrms-lang", lang); } catch { /* ignore */ }
  }, [lang]);

  const t = useCallback((key, params) => {
    let s = messages[lang][key];
    if (s === undefined) s = messages.fr[key];
    if (s === undefined) return key;
    if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : params[k]));
    return s;
  }, [lang]);

  const value = useMemo(() => {
    const locale = lang === "fr" ? "fr-FR" : "en-GB";
    const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
    const shortMonthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
    const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const moneyFmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dtFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return {
      lang, locale, t,
      setLang: (l) => setLangState(LANGS.includes(l) ? l : "fr"),
      toggleLang: () => setLangState((l) => (l === "fr" ? "en" : "fr")),
      date: (iso) => (iso ? dateFmt.format(parseDate(iso)) : "—"),
      day: (iso) => (iso ? dayFmt.format(parseDate(iso)) : "—"),
      month: (iso) => (iso ? monthFmt.format(parseDate(iso)) : "—"),
      shortMonth: (iso) => shortMonthFmt.format(parseDate(iso)),
      datetime: (iso) => (iso ? dtFmt.format(new Date(iso)) : "—"),
      num: (x) => (x === null || x === undefined || x === "" ? "—" : numFmt.format(Number(x))),
      /** amount without the currency, for tables whose header gives it */
      amount: (x) => (x === null || x === undefined || x === "" ? "—" : moneyFmt.format(Number(x))),
      money: (x, currency = "DZD") => (x === null || x === undefined || x === "" ? "—" : `${moneyFmt.format(Number(x))} ${currency}`),
      time: (s) => (s ? String(s).slice(0, 5) : "—"),
      /** field -> message for a form; a business-rule error on a field is translated */
      fieldErrors: (err) => {
        if (!err) return {};
        const out = { ...(err.fields || {}) };
        const f = err.data && err.data.field;
        if (f && err.code && messages[lang]["err." + err.code]) out[f] = t("err." + err.code, err.params);
        return out;
      },
      /** a RuleError or validation error from the API, in the interface language */
      error: (err) => {
        if (!err) return "";
        if (err.code && messages[lang]["err." + err.code]) return t("err." + err.code, err.params);
        if (err.status === 429) return t("err.throttled");
        if (err.status === 403) return t("err.forbidden");
        if (err.status >= 500) return t("err.server");
        if (err.data && err.data.detail) return String(err.data.detail);
        const f = err.fields ? Object.entries(err.fields) : [];
        if (f.length) return f.map(([k, v]) => (k === "non_field_errors" ? v : `${messages[lang]["field." + k] || k} : ${v}`)).join(" · ");
        return err.message || t("err.generic");
      },
    };
  }, [lang, t]);

  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n() {
  return useContext(I18n);
}
