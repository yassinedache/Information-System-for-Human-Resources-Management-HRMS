/* Session state: who is logged in (HR or employee), public settings, and the light/dark theme. */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const Auth = createContext(null);

function initialTheme() {
  try {
    const saved = localStorage.getItem("hrms-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);          // undefined: loading, null: anonymous
  const [settings, setSettings] = useState(null);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("hrms-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const refresh = useCallback(async () => {
    await api.csrf();
    const [s, me] = await Promise.all([
      api.get("/public/settings/"),
      api.get("/auth/me/"),                                 // null for a visitor
    ]);
    setSettings(s);
    setUser(me);
    return me;
  }, []);

  // in the online demo a failure keeps the boot screen, which shows the error and a retry button
  useEffect(() => { refresh().catch(() => { if (!__DEMO__) setUser(null); }); }, [refresh]);

  const login = useCallback(async (email, password) => {
    const me = await api.post("/auth/login/", { email, password });
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout/"); } finally { setUser(null); }
  }, []);

  const value = {
    user, settings, refresh, login, logout, setUser,
    isHR: !!user && user.role === "hr",
    theme, toggleTheme: () => setTheme((x) => (x === "dark" ? "light" : "dark")),
    today: (settings && settings.today) || new Date().toISOString().slice(0, 10),
  };
  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

export function useAuth() {
  return useContext(Auth);
}

/** home page of a logged-in user */
export function homeFor(user) {
  if (!user) return "/login";
  if (user.must_change_password) return "/password";
  return user.role === "hr" ? "/hr" : "/me";
}
