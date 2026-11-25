import "@/styles/base.css";
import "@/ui/ui.css";
import "./app.css";
import { Component, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import { L, loadLang, tr } from "@/i18n";
import { installErrorReporting, reportError } from "@/lib/report";
import { Overlays, closeAllSheets, Osi, Button } from "@/ui";
import { sb } from "./sb";
import { store } from "./data/store";
import { friends } from "./data/friends";
import { Theme } from "./theme";
import { Login, NewPassword } from "./auth/Login";
import { Shell } from "./shell/Shell";

// страница не должна работать внутри чужого фрейма (кликджекинг): заголовок frame-ancestors на GitHub Pages задать нельзя
if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("framed"); }
installErrorReporting();
Theme.init();

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [, setLang] = useState(L.lang);

  useEffect(() => L.subscribe(() => setLang(L.lang)), []);

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id ?? null;
  useEffect(() => {
    if (uid) {
      void store.start(uid).then(() => friends.start()).catch((e) => reportError(e, "start"));
    } else if (session === null) {
      closeAllSheets(); // открытые листы старого аккаунта не должны остаться поверх экрана входа
      friends.stop();
      void store.stop();
    }
  }, [uid, session]);

  let view;
  if (session === undefined) view = <Splash key="splash" />;
  else if (recovery && session) view = <NewPassword key="recovery" onDone={() => setRecovery(false)} />;
  else if (!session) view = <Login key="login" />;
  else view = <Shell key={uid} />;

  // key по языку: после смены языка всё дерево собирается заново, старых строк не остаётся
  return (
    <div className="app-root" key={L.lang}>
      {view}
      <Overlays />
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <Osi size={120} mood="thinking" />
      <p>{tr("Загружаю…")}</p>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { reportError(e, "render"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="splash">
        <Osi size={120} mood="worried" />
        <p>{tr("Что-то пошло не так")}</p>
        <Button small onClick={() => location.reload()}>{tr("Повторить")}</Button>
      </div>
    );
  }
}

await loadLang();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
);
