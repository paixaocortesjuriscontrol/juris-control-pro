import { forwardRef, useMemo, useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useMembrosMencionaveis, type MembroMencionavel } from "@/hooks/useMembrosMencionaveis";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (valor: string) => void;
  /** IDs dos usuários citados com @ no texto atual */
  onMencionadosChange?: (ids: string[]) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
}

/** Extrai os IDs mencionados comparando os nomes presentes no texto. */
export function extrairMencionados(texto: string, membros: MembroMencionavel[]): string[] {
  const ids = new Set<string>();
  const alvo = texto.toLowerCase();
  membros.forEach((m) => {
    if (!m.nome) return;
    if (alvo.includes(`@${m.nome.toLowerCase()}`)) ids.add(m.id);
  });
  return Array.from(ids);
}

/** Renderiza o conteúdo destacando as menções (@Nome). */
export function ConteudoComMencoes({ texto, membros }: { texto: string; membros: MembroMencionavel[] }) {
  const nomes = useMemo(
    () => membros.map((m) => m.nome).filter(Boolean).sort((a, b) => b.length - a.length),
    [membros]
  );
  if (nomes.length === 0) return <>{texto}</>;

  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`@(${nomes.map(escapar).join("|")})`, "gi");
  const partes: (string | { mencao: string })[] = [];
  let ultimo = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    if (match.index > ultimo) partes.push(texto.slice(ultimo, match.index));
    partes.push({ mencao: match[0] });
    ultimo = match.index + match[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));

  return (
    <>
      {partes.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="font-medium text-primary">
            {p.mencao}
          </span>
        )
      )}
    </>
  );
}

/**
 * Textarea com autocompletar de menções: ao digitar "@" abre a lista de
 * membros das coordenações do usuário logado.
 */
export const MencaoTextarea = forwardRef<HTMLTextAreaElement, Props>(function MencaoTextarea(
  { value, onChange, onMencionadosChange, onSubmit, placeholder, className, rows = 2, disabled },
  ref
) {
  const { membros } = useMembrosMencionaveis();
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [busca, setBusca] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);

  const sugestoes = useMemo(() => {
    if (busca === null) return [];
    const termo = busca.trim().toLowerCase();
    const base = termo
      ? membros.filter((m) => m.nome.toLowerCase().includes(termo))
      : membros;
    return base.slice(0, 8);
  }, [busca, membros]);

  useEffect(() => setIndice(0), [busca]);

  useEffect(() => {
    onMencionadosChange?.(extrairMencionados(value, membros));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, membros.length]);

  const setRefs = (el: HTMLTextAreaElement | null) => {
    areaRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as any).current = el;
  };

  const atualizarBusca = (texto: string, caret: number) => {
    const antes = texto.slice(0, caret);
    const m = antes.match(/(?:^|\s)@([\p{L}\p{M}'.\- ]{0,40})$/u);
    setBusca(m ? m[1] : null);
  };

  const aplicar = (membro: MembroMencionavel) => {
    const el = areaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const antes = value.slice(0, caret);
    const depois = value.slice(caret);
    const novoAntes = antes.replace(/@([\p{L}\p{M}'.\- ]{0,40})$/u, `@${membro.nome} `);
    const novo = novoAntes + depois;
    onChange(novo);
    setBusca(null);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = novoAntes.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const aberto = busca !== null && sugestoes.length > 0;

  return (
    <div className="relative flex-1">
      {aberto && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-64 max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {sugestoes.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                aplicar(m);
              }}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left text-sm",
                i === indice ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              {m.nome}
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={setRefs}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        rows={rows}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          atualizarBusca(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          atualizarBusca(el.value, el.selectionStart ?? el.value.length);
        }}
        onBlur={() => setBusca(null)}
        onKeyDown={(e) => {
          if (aberto) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndice((i) => (i + 1) % sugestoes.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndice((i) => (i - 1 + sugestoes.length) % sugestoes.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              aplicar(sugestoes[indice]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setBusca(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </div>
  );
});