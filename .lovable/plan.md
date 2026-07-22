## Ajuste único: condição concomitante em partes + advogados + conteúdo

Alterar apenas a função `condicaoConcomitanteAtendida` (e chamadas equivalentes) para validar a condição concomitante contra um texto combinado que inclua:

- conteúdo/texto da publicação
- metadados de partes (`destinatarios[].nome`, `poloAtivo`, `poloPassivo`, `partes_json`)
- metadados de advogados (`destinatarioadvogados[].advogado.nome`, `advogados_json`)

Nada mais é alterado: a validação do termo principal (tipo `parte`, `advogado`, `palavra-chave`, `processo`) permanece exatamente como está hoje.

### Arquivos a alterar

1. `monitor-servidor/engines/paralela.js`
   - Função `condicaoConcomitanteAtendida`: aceitar o objeto `pub` e concatenar texto + partes + advogados antes de aplicar a lógica atual (AND por `+` / `,`, OR por `|`, frase exata).
   - Ajustar o(s) call site(s) para passar `pub`.

2. `supabase/functions/_kurier-shared/djenMatch.ts`
   - Mesma alteração em `condicaoConcomitanteAtendida` para manter paridade Kurier ↔ Servidor.
   - Ajustar call sites em funções Kurier que chamam essa validação.

3. `src/hooks/useDjenTermosParalelaEngine.ts` (e, se existir com a mesma função, `useDjenTermosEngine.ts` / `useBuscaDjenDireta.ts`)
   - Espelhar o mesmo comportamento — condição concomitante olha texto + partes + advogados.

### Regra final

- Termo principal: continua como está (parte → só partes; advogado → advogados/OAB; palavra-chave → conteúdo).
- Condição concomitante: casa se aparecer em qualquer um de {conteúdo, partes, advogados}.