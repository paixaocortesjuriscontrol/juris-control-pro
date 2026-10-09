# Tipo de Processo antes do Número, na mesma linha (cadastro)

## O que muda

Na ficha de **criação** (botões "Novo Processo" e "Novo Caso" da tela Processos e Casos), a seção **Identificação** passa a ter como primeira linha dois campos lado a lado:

```text
[ Tipo de Processo ]  [ Número do Processo (opcional) ]
```

Hoje o Número do Processo ocupa a linha inteira no topo e o Tipo de Processo só aparece bem abaixo, depois de "Objeto da ação" e "Responsáveis".

Na ficha de um processo **já existente** nada muda: lá o Tipo de Processo continua onde está, ao lado de "Situação".

## Detalhes técnicos

- Arquivo: `src/components/processos/ProcessoVisaoGeralForm.tsx`, seção "Identificação" (linhas ~1585-1655).
- O bloco do `Select` de **Tipo de Processo** é extraído em uma variável JSX reutilizada, para não duplicar o markup.
- Em modo criação (`isNovo`): o Tipo de Processo vira o primeiro item do grid, em meia largura, seguido do campo de número sem `md:col-span-2` (também meia largura) — assim ficam na mesma linha em telas médias para cima e empilhados no celular.
- Fora do modo criação: o Tipo de Processo é renderizado na posição atual, ao lado de "Situação".
- O placeholder do número (CNJ, e-Processo ou formato livre) já depende do tipo escolhido, então selecionar o tipo primeiro mantém o comportamento correto.
- Sem alteração em máscaras, validações, salvamento, banco de dados ou permissões.

## Verificação

- Compilação sem erros.
- Navegação até `/processos/novo` e `/processos/novo?caso=1` para conferir a nova primeira linha e a troca de tipo (Judicial / Administrativo / Outro) refletindo no placeholder.
- Abertura de um processo já cadastrado para confirmar que o layout dele continua igual.
