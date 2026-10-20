import { useEffect, useState } from "react";
import ChatApp from "./components/chat/ChatApp.jsx";
import InfoPanel from "./components/info/InfoPanel.jsx";
import { useBackend } from "./hooks/useBackend.js";
import { player } from "./hooks/usePlayer.js";
import { useRoute } from "./hooks/useRoute.js";
import ReportPage from "./pages/report/ReportPage.jsx";
import "./app-shell.css";

export default function App() {
  const route = useRoute();
  const backend = useBackend();
  const [lang, setLang] = useState("English");
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => { player.pause(); window.scrollTo({ top: 0 }); setInfoOpen(false); }, [route]);

  if (route === "report") return <ReportPage backend={backend} />;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#composer">Skip to the message bar</a>
      <div className="app-window">
        <ChatApp backend={backend} lang={lang} setLang={setLang} onInfo={() => setInfoOpen(true)} />
        <InfoPanel backend={backend} lang={lang} setLang={setLang} open={infoOpen} onClose={() => setInfoOpen(false)} />
        {infoOpen && <button type="button" className="scrim" aria-label="Close info" onClick={() => setInfoOpen(false)} />}
      </div>
    </div>
  );
}
