## Diagnóstico do CSV enviado

Ainda há 23 diferenças líquidas no relatório:

- Dr. Thomás: servidor 55 x browser 51, com 6 só no servidor e 2 só no browser.
- Dra. Janaina: servidor 77 x browser 71, com 6 só no servidor.
- Dra. Vanessa TST: servidor 84 x browser 83, com 1 só no servidor.
- Santander Trabalhista: servidor 90 x browser 82, com 8 só no servidor.

Padrões visíveis:

1. As diferenças “só servidor” estão concentradas em buscas por advogado, especialmente `OSMAR MENDES PAIXAO CORTES` e `CARLOS JOSE ELIAS JUNIOR`.
2. Há repetição do mesmo processo com vários `id_djen` no TST/TRT24, o que pode ser legítimo se forem comunicações distintas, mas precisa ficar auditável.
3. As 2 “só browser” do Dr. Thomás aparecem como `sem_execucao_servidor_para_esta_data`, mas isso pode ser falso diagnóstico se a execução agendada não estiver sendo localizada pela data BRT correta ou se o servidor ainda estiver usando checkpoint antigo.
4. Encontrei no Browser uma rotina de “resgate em outra coordenação” em `src/hooks/useDjenTermosParalelaEngine.ts` que ainda lê `publicacoes_djen` de outra coordenação. Isso conflita com a regra atual de independência total e pode mascarar divergências.
5. O Servidor já está isolado do Browser, mas ainda reutiliza publicações de outras coordenações dentro de `publicacoes_djen_servidor`. Isso é aceitável só se for cópia independente e validada, mas deve ficar separado do diagnóstico.

## Plano de correção

1. Remover o resgate cross-coordination do DJEN Browser
   - Eliminar/desativar `buscarPublicacoesJaEncontradasEmOutraCoordenacao` no Browser.
   - Garantir que o Browser só grave o que a própria coordenação buscou e validou na API.
   - Manter deduplicação apenas dentro da própria coordenação.

2. Alinhar o retry/fallback Direto do Servidor ao Browser, ou remover do Browser para paridade
   - Hoje o Browser, em alguns cenários com VPS vazia, valida no Direto; o Servidor usa apenas `djenFetchSlot`.
   - Vou padronizar a execução para que ambos tenham o mesmo comportamento para página vazia, advogado e parte.
   - Objetivo: se a API/VPS falhar ou vier vazia, ambos perdem/ganham a mesma coisa.

3. Corrigir diagnóstico de execução por data BRT no comparador
   - A causa `sem_execucao_servidor_para_esta_data` será calculada usando o dia DJEN/BRT do payload e não somente `agendado_para` em UTC.
   - Isso deve evitar marcar como “sem execução” quando houve execução às 02h/13h/21h no Brasil.

4. Adicionar detalhamento real de auditoria no CSV
   - Para cada divergência, incluir colunas indicando:
     - se houve execução servidor válida para a coordenação/dia;
     - status da execução;
     - horário finalizado;
     - se veio por busca direta, fallback OAB ou termo OR quando disponível;
     - se é múltiplo `id_djen` para o mesmo processo/data.
   - Assim a divergência deixa de ser só número e passa a apontar causa objetiva.

5. Revisar deduplicação do Browser em todos os pontos restantes
   - Confirmar que `useSincronizarDjenBrowser.ts`, `useDjenTermosParalelaEngine.ts`, `backfill-djen` e `backfill-djen-jina` não travam uma coordenação por causa de outra.
   - Ajustar qualquer consulta por `id_djen` sem `coordenacao_id`.

6. Manter Servidor e Browser separados
   - Não copiar nada de `publicacoes_djen` para `publicacoes_djen_servidor`.
   - Não usar Browser como fonte do Servidor.
   - O comparador continua sendo a única leitura cruzada, apenas visual/auditável.

## Resultado esperado

Depois da implementação e nova execução limpa:

- Browser e Servidor devem comparar por coordenação independente.
- Diferenças por “publicação achada em outra coordenação” não serão mais justificadas nem mascaradas.
- O CSV mostrará se a diferença é API vazia/falha, execução não feita, horário posterior, duplicidade legítima por múltiplos `id_djen`, ou validação diferente.
- A próxima divergência, se existir, terá causa objetiva no próprio relatório.