## Três entregas independentes

### 1) Mapeamento da planilha Kurier (XLSX de revisão)

Gerar `/mnt/documents/mapeamento-kurier-por-login.xlsx` com 4 abas, **sem gravar nada no banco**:

- **Resumo por login** — 11 logins, contagem de termos, totais.
- **Termos × Diários** — uma linha por (login, termo): variações, diários que o Kurier monitora hoje (TST_DJEN, TRT*_DJEN, DJ estaduais), classificação Trabalhista/Estadual/Federal/Superior.
- **Variações** — aba `VARIAÇÕES DOS TERMOS DE PESQUISA` consolidada por (login, termo) — vira `termos_or` no cadastro.
- **Tribunais sugeridos** — mapeamento Diário Kurier → tribunal DJEN (`TRT 10_DJEN`→TRT10, `DJGO`→TJGO, `TST_DJEN`→TST etc.).

Distribuição já levantada:

| Login | # termos |
|---|---|
| paixao.adv | 5 |
| paixao.cortes.adv | 6 |
| paixaoc | 12 |
| paixaoc.02 | 13 |
| paixaoc.04 / .07 / .08 | 2 cada |
| paixaoc.09 | 3 |
| paixaoc.heinz | 1 |
| paixaocortes.df | 2 |
| paixaocortes2 | 8 |

Você revisa o XLSX antes de qualquer cadastro.

### 2) Uma coordenação Kurier por login

Após sua aprovação do XLSX, criar **11 coordenações** em `coordenacoes` no padrão `Kurier - <login>` (ex.: `Kurier - paixaoc`, `Kurier - paixaoc.02`, `Kurier - paixao.cortes.adv`…) e popular `monitoramentos_djen` apenas com os termos daquele login.

Regras de cadastro:
- `tipo` padrão **`parte`** (razões sociais). Para logins de pessoas físicas advogadas (BEATRIZ, CARLOS ELIAS JR, LIDIANE, OSMAR, RENATA MOUTA, TAÍS), usar tipo **`advogado`** com `termos_or` contendo as variações.
- `termos_or` derivado da aba "Variações" do XLSX da etapa 1.
- `tribunais` derivado dos diários do Kurier (mapeamento da aba 4).
- `ativo = false` (não dispara até você ligar manualmente).
- Vincular cada coordenação à credencial Kurier correspondente em `kurier_credencial_coordenacoes` (`coordenacao_id` ↔ `credencial.login`).
- A coordenação atual `DJEN Termos Kurier` permanece intocada.

### 3) Novo tipo "Busca Geral" no select Tipo de Busca

Acrescentar **uma nova opção** sem alterar as 4 existentes:

```
- Palavra-chave / Razão Social
- Advogado (OAB ou Nome)
- Número do Processo
- Polo passivo ou ativo
+ Busca Geral (partes, advogados, conteúdo e processo)
```

Internamente `tipo = 'geral'`.

**Comportamento na API DJEN**: dispara em paralelo nas 3 filas `parte`, `advogado` (por nome) e `palavra-chave` (texto livre), unindo por `id_djen` (dedup).

**Validação** (frontend, server engine e edge `monitorar-djen`): o termo casa se aparecer em **qualquer** campo — `partes_json`, `advogados_json`, número do processo (dígitos) ou conteúdo. Não aplica a regra estrita "parte só em partes / advogado só em advogados" — é justamente o tipo "amplo".

Suporta `termos_or`, `exclusoes`, `condicao_concomitante`, `tribunais` como os demais. UF opcional; OAB não se aplica.

#### Arquivos a tocar (somente etapa 3)
- `src/components/djen/MonitoramentoDialog.tsx` — novo `SelectItem value="geral"`; UI reaproveita a do `palavra-chave`; ajuste em `isUfValid`.
- `src/hooks/useDjenTermosParalelaEngine.ts` — `mapMonTipoToWorkerTipo('geral')` enfileira nas 3 filas; coletor une resultados; validação aceita match em qualquer campo.
- `src/hooks/useDjenTermosKurierEngine.ts` — passa o termo como texto livre (Kurier já é busca ampla).
- `monitor-servidor/engines/paralela.js` — espelha a mesma lógica no servidor.
- `supabase/functions/monitorar-djen/validation.ts` — `conteudoContemTermoOuOr` ganha ramo `tipo === 'geral'`: aceita match em texto, partes (`partes_json`), advogados (`advogados_json`) ou número de processo.
- `src/hooks/useMonitoramentosDjen.ts` e `src/types/djenProgress.ts` — adicionar `'geral'` aos tipos TS.

Sem mudança de schema (coluna `tipo` já é texto livre).

### Ordem

1. Gerar XLSX (etapa 1) — você revisa.
2. Após aprovação, criar coordenações + termos (etapa 2) via `supabase--insert`.
3. Implementar "Busca Geral" (etapa 3) no front + edge + server.

Cada etapa é independente — posso reordenar conforme você decidir após a etapa 1.