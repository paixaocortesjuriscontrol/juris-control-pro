import { useQuery } from "@tanstack/react-query";
import {
  buscarReferenciasAuditoria,
  REFERENCIAS_AUDITORIA_VAZIAS,
  type CampoAuditoria,
} from "@/lib/auditoriaReferencias";

export function useReferenciasAuditoria(campos: CampoAuditoria[], enabled = true) {
  const chave = JSON.stringify(campos);
  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-referencias", chave],
    queryFn: () => buscarReferenciasAuditoria(campos),
    enabled: enabled && campos.length > 0,
    staleTime: 60_000,
  });
  return { referencias: data ?? REFERENCIAS_AUDITORIA_VAZIAS, carregandoReferencias: isLoading };
}
