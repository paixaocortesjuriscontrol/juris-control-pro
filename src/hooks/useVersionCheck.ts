import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_VERSION } from "@/constants/version";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Detecta nova versão do app comparando APP_VERSION (em memória) com /version.json (servidor).
 * Mostra toast persistente "Atualizar agora" quando detecta divergência.
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
        if (remote && remote !== APP_VERSION) {
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