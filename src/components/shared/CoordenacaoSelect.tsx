import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacaoPadrao } from "@/hooks/useCoordenacaoPadrao";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CoordenacaoSelectProps {
  value: string | null | undefined;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  /** Delegação: coordenadores globais veem todas; os demais, apenas as próprias. */
  delegacao?: boolean;
  /** Pré-seleciona a coordenação do usuário quando vazio (desligar na edição). */
  autoSelect?: boolean;
}

/** Seletor de coordenação compartilhado pelos formulários de agendamento. */
export function CoordenacaoSelect({
  value,
  onChange,
  label = "Coordenação",
  required,
  className,
  delegacao,
  autoSelect = true,
}: CoordenacaoSelectProps) {
  const {
    coordenacoes: listaBase,
    coordenacaoSugeridaId,
    isLoading,
    isError,
    refetch,
  } = useCoordenacoesDoUsuario({ incluirTodasParaCoordenador: !!delegacao });
  const { data: coordPadraoPerfil } = useCoordenacaoPadrao();

  // Padrão: coordenação do perfil (se acessível); senão, uma coordenação própria.
  const defaultId =
    (coordPadraoPerfil && listaBase.some((c) => c.id === coordPadraoPerfil) ? coordPadraoPerfil : null) ??
    coordenacaoSugeridaId;
  const faltaNaLista = !!value && !isLoading && !isError && !listaBase.some((c) => c.id === value);

  // Coordenação gravada fora da lista do usuário: busca o nome só para exibir.
  const { data: extra } = useQuery({
    queryKey: ["coordenacao-select-extra", value],
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .eq("id", value as string)
        .maybeSingle();
      if (error) throw error;
      return c;
    },
    enabled: faltaNaLista,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
  const coordenacoes = faltaNaLista && extra ? [extra, ...listaBase] : listaBase;

  // Reage também quando a consulta termina depois da abertura do formulário.
  useEffect(() => {
    if (autoSelect && !value && defaultId) onChange(defaultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, defaultId, autoSelect]);

  return (
    <div className={className}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value ?? ""} onValueChange={(v) => { if (v) onChange(v); }}>
        <SelectTrigger className="h-10 mt-1.5" disabled={isLoading || isError}>
          <SelectValue placeholder={isLoading ? "Carregando coordenações..." : "Selecione a coordenação"} />
        </SelectTrigger>
        <SelectContent>
          {coordenacoes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="mt-1.5 text-xs text-destructive">
          Não foi possível carregar as coordenações.{" "}
          <button type="button" className="font-medium underline" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
    </div>
  );
}
