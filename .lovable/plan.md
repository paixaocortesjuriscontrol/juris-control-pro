# Estrutura GOL: leitura central e 4 grupos

## Como fica

```text
Coordenação GOL (lê as publicações)  Supervisão: Dr. Carlos | Direção: Dr. Osmar
  Termos: só os da GOL + Dr. Carlos + Dr. Osmar
  Tribunais: todos, inclusive TST, menos TRT 1, 2 e 15
        |
        +-- Execução GOL - Dra B. Anjos ............ (já existe)
        +-- GOL - Norte e Nordeste - Dr. Davis ...... (já existe)
        +-- GOL - Centro, Sul e Minas - Dr. Carlos .. (nova)
        +-- GOL - Casos Especiais (Sindicatos e MPT)  (nova)
              Dras. Beatriz Anjos, Gisele e Fernanda
```

Cada grupo é uma coordenação ligada à GOL. Assim cada um tem a própria equipe, a própria agenda e os próprios "Responsáveis fixos". As permissões de quem pode mudar cada situação continuam valendo.

## O que muda

1. **Termos de busca: nenhum é desativado**
   - Os termos da Coordenação GOL e da Execução GOL continuam todos ativos, como estão hoje.
   - Confiro se GOL LINHAS, WEBJET, SMILES, VRG, G.L.A.S., GOL TRANSPORTES, CARLOS JOSE ELIAS JUNIOR e OSMAR MENDES PAIXAO CORTES já existem. Só crio os que faltarem.
   - Os tribunais dos termos não mudam. Só os termos novos vão cobrir todos os tribunais, inclusive o TST, menos os TRT 1, 2 e 15.

2. **Criar 2 coordenações**
   - **Centro, Sul e Minas:** coordenador Dr. Carlos. Equipe: Phelipe, Emilly, Daiane e Fernanda.
   - **Casos Especiais (Sindicatos e MPT):** coordenadoras Dras. Beatriz Anjos, Gisele e Fernanda.
   - Dr. Carlos entra como coordenador em todos os grupos, para a supervisão.

3. **Delegar da leitura para o grupo**
   - Na Análise DJEN da GOL, ao criar um prazo ou uma tarefa a partir da publicação, aparece a escolha **"Enviar para o grupo"**: Execução, Norte e Nordeste, Centro, Sul e Minas ou Casos Especiais.
   - O item vai para a agenda do grupo escolhido e o coordenador recebe o aviso. Depois ele repassa para a equipe com a troca de responsável que já existe.
   - O sistema sugere o grupo pelo tribunal:
     - TRT 5, 6, 7, 8, 11, 13, 14, 16, 19, 20, 21 e 22 vão para **Norte e Nordeste**.
     - Os demais TRTs e o TST vão para **Centro, Sul e Minas**.
     - Execução e Casos Especiais são escolhidos por quem lê.

4. **Equipes:** os membros atuais da Execução e da Norte e Nordeste ficam como estão.

5. **Bruna Sousa: leitura e cobrança**
   - Ela entra na GOL e nos 4 grupos como **Assistente Coordenador**. É ela quem lê as publicações e delega para os grupos.
   - Ela vê os prazos e os prazos fatais de todos os grupos no Painel e no Kanban de Prazos Fatais, para poder cobrar.
   - Ela não precisa ser responsável pelos itens.

## Definido pelo cliente
- Os processos do TRT 1, 2 e 15 que já estão cadastrados ficam como estão. Só a busca de novas publicações deixa de cobrir esses tribunais.
- A Coordenação Dra. Beatriz Costa e o que ela definiu não mudam. Essa estrutura nova não tem relação com ela.

## Detalhes técnicos
- Dados (sem mudar a estrutura do banco): `monitoramentos_djen` (`ativo=false` nos termos fora do escopo, ajuste de `tribunais`), insert em `coordenacoes` e `membros_coordenacao` (cargo `coordenador`).
- Frontend: seletor "Enviar para o grupo" no `NovoItemPanel` chamado pela Análise DJEN, que grava `coordenacao_id` do grupo, com sugestão por região do TRT (posições 15-16 do CNJ). A lista de grupos fica numa constante ligada à GOL.
- Sem trigger automático: os envolvidos continuam vindo de `responsaveis_fixos_tipo_tarefa`.
