

## Transformar Condição Concomitante em lista com botão "+"

### O que muda para o usuário
Ao invés de digitar tudo em um campo de texto livre, você poderá adicionar cada condição concomitante individualmente com um botão "+", igual aos critérios de exclusão. Cada item adicionado funciona como **OU** entre si.

**Exemplo prático:** Para o Advogado OSMAR que tem GOL ou CITIBANK ou SANTANDER:
- Adicionar "GOL" (clica +)
- Adicionar "CITIBANK" (clica +)  
- Adicionar "SANTANDER" (clica +)

A publicação será aceita se contiver OSMAR **E** (GOL **OU** CITIBANK **OU** SANTANDER).

Se precisar de AND entre termos dentro de um mesmo item, use vírgula: "BRADESCO, SERVIÇO DE APOIO" significa que ambos devem aparecer juntos.

### O que NÃO muda
- A lógica de validação existente permanece idêntica (separador `|` para OR, `,` para AND interno)
- Publicações já salvas continuam funcionando
- O campo no banco `condicao_concomitante` continua sendo texto simples (os itens são unidos por ` | ` ao salvar)

### Detalhes técnicos

**Arquivo: `src/components/djen/MonitoramentoDialog.tsx`**

1. Adicionar novo estado `condicoesConcomitantes` (array de strings) e `novaCondicao` (string), similar ao pattern de `exclusoes`/`novaExclusao`

2. No `useEffect` de inicialização, converter o campo string existente `condicao_concomitante` em array separando por `|`:
   ```
   monitoramento.condicao_concomitante?.split('|').map(s => s.trim()).filter(Boolean) || []
   ```

3. Adicionar funções `handleAddCondicao` e `handleRemoveCondicao` seguindo o pattern de exclusões

4. Substituir o Input simples por Input + botão "+" + lista de badges com X (mesmo layout das exclusões)

5. Ao salvar, unir o array em string com ` | `: `condicoesConcomitantes.join(' | ') || undefined`

6. Atualizar o tooltip para explicar: "Cada condição é um critério OR. A publicação deve conter o termo principal E pelo menos uma das condições. Para AND dentro de uma condição, use vírgula."

**Nenhuma alteração nos hooks de validação** - a string salva no banco continua no mesmo formato `TERMO1 | TERMO2 | TERMO3` que já é processada corretamente por `condicaoConcomitanteAtendida` em todos os engines.
