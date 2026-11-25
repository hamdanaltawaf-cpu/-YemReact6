'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Reaction } from '@/lib/reactions';
export type Account = { id: string; name: string; email: string; role: 'member' | 'admin' };
type Notice = { id: number; text: string; time: string };
type AppState = {
  reactions: Reaction[];
  refresh: () => Promise<void>;
  saved: string[];
  toggleSave: (code: string, options?: { silent?: boolean; saved?: boolean }) => Promise<boolean>;
  authError: string;
  savedReady: boolean;
  savedError: string;
  preferencesError: boolean;
  user: Account | null;
  authReady: boolean;
  syncUser: () => Promise<void>;
  logout: () => Promise<boolean>;
  preview: string | null;
  setPreview: (v: string | null) => void;
  theme: string;
  setTheme: (v: string) => boolean;
  accent: string;
  setAccent: (v: string) => boolean;
  reduced: boolean;
  setReduced: (v: boolean) => boolean;
  settings: boolean;
  setSettings: (v: boolean) => void;
  toast: (text: string) => void;
  notices: Notice[];
  clearNotices: () => void;
};
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children, initial }: { children: ReactNode; initial: Reaction[] }) {
  const [reactions, setReactions] = useState(initial),
    [saved, setSaved] = useState<string[]>([]),
    [user, setUser] = useState<Account | null>(null),
    [authReady, setAuthReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null),
    [settings, setSettings] = useState(false),
    [theme, setThemeState] = useState('system'),
    [accent, setAccentState] = useState('#c1592e'),
    [reduced, setReducedState] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]),
    [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(new Set<string>());
  const [authError, setAuthError] = useState('');
  const [savedReady, setSavedReady] = useState(false);
  const [savedError, setSavedError] = useState('');
  const [preferenceFailures, setPreferenceFailures] = useState<string[]>([]);
  const generation = useRef(0);
  const session = useRef<Account | null>(null);
  const savedRef = useRef<string[]>([]);
  const verified = useRef(false);
  function publishSaved(codes: string[]) {
    savedRef.current = codes;
    setSaved(codes);
  }
  function writePreference(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setPreferenceFailures((old) => old.filter((item) => item !== key));
      return true;
    } catch {
      setPreferenceFailures((old) => [...new Set([...old, key])]);
      return false;
    }
  }

  const toast = useCallback((text: string) => {
    setMessage(text);
    setNotices((old) =>
      [{ id: Date.now(), text, time: new Date().toISOString() }, ...old].slice(0, 12),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4200);
  }, []);
  const syncUser = useCallback(async () => {
    const request = ++generation.current;
    verified.current = false;
    setAuthReady(false);
    setAuthError('');
    setSavedReady(false);
    setSavedError('');
    session.current = null;
    setUser(null);
    publishSaved([]);
    try {
      const res = await fetch('/api/auth', { cache: 'no-store' });
      if (!res.ok) throw Error();
      const data = await res.json();
      if (request !== generation.current) return;
      if (!Object.hasOwn(data, 'user')) throw Error();
      session.current = data.user || null;
      setUser(session.current);
      verified.current = true;
      setAuthReady(true);
      try {
        let codes: unknown;
        if (data.user) {
          const response = await fetch('/api/saved', { cache: 'no-store' });
          if (!response.ok) throw Error();
          codes = (await response.json()).saved;
        } else {
          codes = JSON.parse(localStorage.getItem('yr:guest-saved') || '[]');
        }
        if (!Array.isArray(codes) || !codes.every((code) => typeof code === 'string'))
          throw Error();
        if (request !== generation.current) return;
        publishSaved([...new Set(codes)]);
        setSavedReady(true);
      } catch {
        if (request === generation.current)
          setSavedError('تعذّر تحميل المحفوظات. تحقق من الاتصال أو تخزين المتصفح وحاول مجددًا.');
      }
    } catch {
      if (request === generation.current) {
        setAuthError('تعذّر التحقق من الحساب.');
        setAuthReady(true);
      }
    }
  }, []);
  useEffect(() => {
    function preference<T>(key: string, fallback: T): T {
      try {
        return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
      } catch {
        setPreferenceFailures((old) => [...new Set([...old, key])]);
        return fallback;
      }
    }
    setThemeState(preference('yr:theme', 'system'));
    setAccentState(preference('yr:accent', '#c1592e'));
    setReducedState(preference('yr:motion', false));
    syncUser();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [syncUser]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
  }, [accent, reduced]);
  const setTheme = (v: string) => {
    setThemeState(v);
    return writePreference('yr:theme', v);
  };
  const setAccent = (v: string) => {
    if (/^#[a-f0-9]{6}$/i.test(v)) {
      setAccentState(v);
      return writePreference('yr:accent', v);
    }
    return false;
  };
  const setReduced = (v: boolean) => {
    setReducedState(v);
    return writePreference('yr:motion', v);
  };
  async function toggleSave(code: string, options: { silent?: boolean; saved?: boolean } = {}) {
    if (!verified.current || !savedReady) return false;
    const request = generation.current;
    const pendingKey = `${request}:${code}`;
    if (pending.current.has(pendingKey)) return false;
    pending.current.add(pendingKey);
    const exists = savedRef.current.includes(code);
    const target = options.saved ?? !exists;
    if (exists === target) {
      pending.current.delete(pendingKey);
      return true;
    }
    try {
      if (session.current) {
        const response = await fetch('/api/saved', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, saved: target }),
        });
        if (!response.ok) throw Error();
      }
      if (request !== generation.current) return false;
      const next = target
        ? [...savedRef.current, code]
        : savedRef.current.filter((item) => item !== code);
      if (!session.current) localStorage.setItem('yr:guest-saved', JSON.stringify(next));
      publishSaved([...new Set(next)]);
      if (!options.silent)
        toast(target ? 'حفظناه لك. ارجع له وقت ما تحتاج.' : 'أُزيل من المحفوظات');
      return true;
    } catch {
      if (request === generation.current && !options.silent)
        toast('تعذّر الحفظ. تحقق من الاتصال أو تخزين المتصفح.');
      return false;
    } finally {
      pending.current.delete(pendingKey);
    }
  }
  async function refresh() {
    const r = await fetch('/api/reactions');
    if (!r.ok) throw Error('تعذّر تحديث المكتبة');
    const items: Reaction[] = (await r.json()).reactions;
    setReactions(items);
    publishSaved(savedRef.current.filter((code) => items.some((item) => item.code === code)));
  }
  async function logout(): Promise<boolean> {
    ++generation.current;
    verified.current = false;
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('Logout failed');
      await syncUser();
      toast('تم تسجيل الخروج');
      return true;
    } catch {
      await syncUser();
      toast('تعذّر تسجيل الخروج');
      return false;
    }
  }
  return (
    <AppContext.Provider
      value={{
        reactions,
        refresh,
        saved,
        toggleSave,
        user,
        authReady,
        authError,
        savedReady,
        savedError,
        preferencesError: preferenceFailures.length > 0,
        syncUser,
        logout,
        preview,
        setPreview,
        theme,
        setTheme,
        accent,
        setAccent,
        reduced,
        setReduced,
        settings,
        setSettings,
        toast,
        notices,
        clearNotices: () => setNotices([]),
      }}
    >
      {children}
      <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">
        <span className="toast-dot" />
        {message}
      </div>
    </AppContext.Provider>
  );
}
export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw Error('AppProvider missing');
  return app;
}
export function track(kind: 'play' | 'download' | 'share', code: string) {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, code }),
  }).catch(() => {});
}
