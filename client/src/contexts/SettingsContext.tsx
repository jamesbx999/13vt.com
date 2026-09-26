import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLanguage } from "./LanguageContext";

export const REFRESH_OPTIONS = [15, 30, 60, 120] as const;
export type RefreshInterval = (typeof REFRESH_OPTIONS)[number];

type SettingsContextValue = {
  toastEnabled: boolean;
  setToastEnabled: (enabled: boolean) => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (seconds: RefreshInterval) => void;
  autoRefreshPaused: boolean;
  setAutoRefreshPaused: (paused: boolean) => void;
  resetSettings: () => void;
  isPageVisible: boolean;
};

const STORAGE_KEY = "onchain-queue-settings";
const SettingsContext = createContext<SettingsContextValue>({
  toastEnabled: true,
  setToastEnabled: () => undefined,
  refreshInterval: 30,
  setRefreshInterval: () => undefined,
  autoRefreshPaused: false,
  setAutoRefreshPaused: () => undefined,
  resetSettings: () => undefined,
  isPageVisible: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [toastEnabled, setToastEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(30);
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (typeof saved.toastEnabled === "boolean") setToastEnabled(saved.toastEnabled);
      if (REFRESH_OPTIONS.includes(saved.refreshInterval)) setRefreshInterval(saved.refreshInterval);
      if (typeof saved.autoRefreshPaused === "boolean") setAutoRefreshPaused(saved.autoRefreshPaused);
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ toastEnabled, refreshInterval, autoRefreshPaused }));
  }, [toastEnabled, refreshInterval, autoRefreshPaused]);

  useEffect(() => {
    const onVisibilityChange = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const resetSettings = () => {
    setToastEnabled(true);
    setRefreshInterval(30);
    setAutoRefreshPaused(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return <SettingsContext.Provider value={useMemo(() => ({ toastEnabled, setToastEnabled, refreshInterval, setRefreshInterval, autoRefreshPaused, setAutoRefreshPaused, resetSettings, isPageVisible }), [toastEnabled, refreshInterval, autoRefreshPaused, isPageVisible])}>{children}</SettingsContext.Provider>;
}

export function useSettings() { return useContext(SettingsContext); }

export function useAppToast() {
  const { toastEnabled } = useSettings();
  return useMemo(() => ({
    success: (...args: Parameters<typeof toast.success>) => toastEnabled && toast.success(...args),
    info: (...args: Parameters<typeof toast.info>) => toastEnabled && toast.info(...args),
    error: (...args: Parameters<typeof toast.error>) => toastEnabled && toast.error(...args),
  }), [toastEnabled]);
}

export function SettingsPanel() {
  const { toastEnabled, setToastEnabled, refreshInterval, setRefreshInterval, autoRefreshPaused, setAutoRefreshPaused, resetSettings } = useSettings();
  const { t } = useLanguage();
  return <details className="relative">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"><span aria-hidden="true">⚙</span><span className="hidden sm:inline">{t("settings")}</span></summary>
    <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
      <p className="font-bold text-slate-900">{t("dashboardSettings")}</p>
      <label className="mt-4 flex items-center justify-between gap-3 text-slate-600"><span>{t("toastNotifications")}</span><input type="checkbox" checked={toastEnabled} onChange={event => setToastEnabled(event.target.checked)} className="h-4 w-4 accent-teal-600" /></label>
      <label className="mt-4 block text-slate-600"><span>{t("autoRefreshInterval")}</span><select value={refreshInterval} onChange={event => setRefreshInterval(Number(event.target.value) as RefreshInterval)} className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none focus:border-teal-400">{REFRESH_OPTIONS.map(seconds => <option key={seconds} value={seconds}>{seconds} {t("seconds")}</option>)}</select></label>
      <button type="button" onClick={() => setAutoRefreshPaused(!autoRefreshPaused)} className="mt-4 w-full rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50">{autoRefreshPaused ? t("resumeAutoRefresh") : t("pauseAutoRefresh")}</button>
      <button type="button" onClick={resetSettings} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">{t("resetSettings")}</button>
      <p className="mt-3 text-[11px] leading-4 text-slate-400">{t("savedOnDevice")}</p>
    </div>
  </details>;
}
