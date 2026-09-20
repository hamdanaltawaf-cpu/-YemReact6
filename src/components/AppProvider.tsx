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
  toggleSave: (code: string) => Promise<void>;
  user: Account | null;
  authReady: boolean;
  syncUser: () => Promise<void>;
  logout: () => Promise<void>;
  preview: string | null;
  setPreview: (v: string | null) => void;
  theme: string;
  setTheme: (v: string) => void;
  accent: string;
  setAccent: (v: string) => void;
  reduced: boolean;
  setReduced: (v: boolean) => void;
  settings: boolean;
  setSettings: (v: boolean) => void;
  toast: (text: string) => void;
  notices: Notice[];
  clearNotices: () => void;
};
const AppContext = createContext<AppState | null>(null);
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
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
  const toast = useCallback((text: string) => {
    setMessage(text);
    setNotices((old) =>
      [{ id: Date.now(), text, time: new Date().toISOString() }, ...old].slice(0, 12),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4200);
  }, []);
  const syncUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user);
      if (data.user) {
        const r = await fetch('/api/saved');
        if (r.ok) setSaved((await r.json()).saved);
      } else setSaved(read('yr:guest-saved', []));
    } catch {
      /* Offline visitors retain their local collection. */ setSaved(read('yr:guest-saved', []));
    } finally {
      setAuthReady(true);
    }
  }, []);
  useEffect(() => {
    setThemeState(read('yr:theme', 'system'));
    setAccentState(read('yr:accent', '#c1592e'));
    setReducedState(read('yr:motion', false));
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
    localStorage.setItem('yr:theme', JSON.stringify(v));
  };
  const setAccent = (v: string) => {
    if (/^#[a-f0-9]{6}$/i.test(v)) {
      setAccentState(v);
      localStorage.setItem('yr:accent', JSON.stringify(v));
    }
  };
  const setReduced = (v: boolean) => {
    setReducedState(v);
    localStorage.setItem('yr:motion', JSON.stringify(v));
  };
  async function toggleSave(code: string) {
    if (pending.current.has(code)) return;
    pending.current.add(code);
    const exists = saved.includes(code),
      next = exists ? saved.filter((c) => c !== code) : [...saved, code];
    setSaved(next);
    try {
      if (user) {
        const r = await fetch('/api/saved', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, saved: !exists }),
        });
        if (!r.ok) throw Error();
      } else localStorage.setItem('yr:guest-saved', JSON.stringify(next));
      toast(exists ? 'أُزيل من المحفوظات' : 'حفظناه لك. ارجع له وقت ما تحتاج.');
    } catch {
      setSaved(saved);
      toast('تعذّر الحفظ. تحقق من الاتصال.');
    } finally {
      pending.current.delete(code);
    }
  }
  async function refresh() {
    const r = await fetch('/api/reactions');
    if (!r.ok) throw Error('تعذّر تحديث المكتبة');
    const items: Reaction[] = (await r.json()).reactions;
    setReactions(items);
    setSaved((old) => old.filter((code) => items.some((item) => item.code === code)));
  }
  async function logout() {
    const r = await fetch('/api/auth', { method: 'DELETE' });
    if (!r.ok) {
      toast('تعذّر تسجيل الخروج');
      return;
    }
    await syncUser();
    toast('تم تسجيل الخروج');
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
