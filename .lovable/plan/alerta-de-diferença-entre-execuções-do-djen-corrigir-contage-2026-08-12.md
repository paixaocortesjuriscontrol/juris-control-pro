# Alerta de diferença entre execuções do DJEN: corrigir contagem

## O que aconteceu (verificado no banco)

Para a Coordenação Dra. Renata, o alerta das 17:45 (BRT) informou "execução anterior 239 / atual 249 / +10". Consultando os dados:

- A execução das 17:45 (`db19c4b7…`) tem 249 publicações vinculadas, mas a **mais recente delas foi criada às 10:00 BRT** — ou seja, nenhuma publicação nova foi gravada por aquela execução.
- Na tabela que a tela usa (`publicacoes_djen`), a coordenação tem 183 registros hoje: 181 criados às 04:00 BRT e 2 às 10:00 BRT. Nada depois disso.
- Nenhuma publicação da coordenação foi descartada hoje.

Conclusão: a advogada está certa. Os números da tela (183 total / 127 após deduplicação) estão corretos e o "+10" do e-mail é **falso positivo**.

Duas causas somadas:

1. A rotina conta **vínculos execução↔publicação**, não publicações novas. Se uma publicação antiga do dia é revinculada a uma execução posterior (revarredura, resgate entre coordenações, tribunal que respondeu na segunda passada), ela entra como "diferença" mesmo já estando no sistema desde a manhã.
2. A rotina conta a tabela legada `publicacoes_djen_servidor` (252 registros hoje nessa coordenação), enquanto a tela lê `publicacoes_djen` com deduplicação e sem descartadas (183 / 127). As bases são diferentes, então os números nunca vão bater.

## Correção proposta

1. **Contar apenas publicações realmente novas**: na comparação entre execuções, considerar só publicações cuja data de criação está dentro da janela da execução atual (após o início da execução anterior). Publicações já existentes revinculadas deixam de gerar alerta.
2. **Usar a mesma base da tela**: contar `publicacoes_djen` (motor unificado), excluindo as que estão em `publicacoes_djen_descartadas`, para que o número do e-mail corresponda ao que a advogada vê ao abrir a Análise DJEN.
3. **Deixar o e-mail autoexplicativo**: mostrar "novas publicações gravadas nesta execução" com horário das duas execuções (BRT) e o total do dia da coordenação, com a observação de que o total da tela é deduplicado.
4. **Não enviar alerta quando a diferença real for zero** — hoje o e-mail sai mesmo sem nada novo.

## Detalhes técnicos

- Arquivo: `supabase/functions/alertar-diferenca-djen-termos/index.ts`.
- Substituir a junção por `publicacoes_djen_servidor_execucoes` / `publicacoes_djen_servidor` por contagem em `publicacoes_djen` (via `monitoramentos_djen.coordenacao_id`), filtrando `created_at` na janela `[início da execução anterior, fim da execução atual)` e excluindo IDs presentes em `publicacoes_djen_descartadas`.
- Manter a idempotência atual por `alertas_diferenca_execucoes_djen` (execução + coordenação) e o consolidado para administradores.
- Sem mudança de schema; nenhuma alteração na tela de Análise DJEN.

## Resposta à advogada

Os números da tela estão corretos: as publicações do dia foram gravadas até as 10:00 e não houve novas depois. O "+10" do alerta contou revinculações de publicações já existentes, não publicações novas — vamos ajustar a rotina.
