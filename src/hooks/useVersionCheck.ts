import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_VERSION } from "@/constants/version";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const compareVersions = (remoteVersion: string, currentVersion: string) => {
  const remoteParts = remoteVersion.match(/\d+/g)?.map(Number) || [];
  const currentParts = currentVersion.match(/\d+/g)?.map(Number) || [];
  const maxLength = Math.max(remoteParts.length, currentParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const remotePart = remoteParts[i] || 0;
    const currentPart = currentParts[i] || 0;

    if (remotePart > currentPart) return 1;
    if (remotePart < currentPart) return -1;
  }

  return 0;
};

/**
 * Detecta nova versão do app comparando APP_VERSION (em memória) com /version.json (servidor).
 * Mostra toast persistente "Atualizar agora" apenas quando o servidor tiver versão mais nova.
 */
export function useVersionCheck() {
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (notifiedRef.current) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const remote = String(data?.version || "").trim();
        if (cancelled || !remote) return;
        if (compareVersions(remote, APP_VERSION) > 0) {
          notifiedRef.current = true;
          toast.message("Nova versão disponível", {
            description: `Versão ${remote} foi publicada (você está na ${APP_VERSION}). Atualize para receber as últimas correções.`,
            duration: Infinity,
            action: {
              label: "Atualizar agora",
              onClick: () => {
                // Bypass cache do navegador
                window.location.reload();
              },
            },
          });
        }
      } catch {
        // silencioso — sem rede, tenta de novo no próximo ciclo
      }
    };

    // Primeira checagem após 30s (não atrapalha boot)
    const initial = window.setTimeout(check, 30_000);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}