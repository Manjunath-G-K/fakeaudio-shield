import { useEffect, useState } from "react";

const read = () => (window.location.hash.startsWith("#/results") ? "report" : "chat");

/** Two screens: the chat ("#/") and Shield's report ("#/results"). Hash routing works on any static host. */
export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
