# Explicar na tela como funciona "Restringir"

Hoje, com "Restringir" ligado, só usa a situação quem estiver marcado (cargos ou pessoas), além do administrador. O funcionamento não muda; só a explicação na tela.

## O que vai aparecer
No topo do painel "Quem pode mudar cada situação", logo abaixo do título, um quadro de aviso com:

- **Sem "Restringir":** todos da coordenação podem usar a situação.
- **Com "Restringir":** só podem usar os **cargos marcados** e as **pessoas marcadas**. Quem não estiver marcado perde o acesso, inclusive coordenadores.
- **Exemplo:** marcando só pessoas e nenhum cargo, apenas essas pessoas podem usar a situação.
- **Chave Ativa desligada:** a situação some do seletor para todos.
- O **administrador** sempre pode.
- As mudanças só valem depois de **Salvar**. Cancelar descarta tudo.

## Detalhes técnicos
- `PermissoesSituacaoDialog.tsx`: bloco informativo com tokens semânticos (`bg-muted`, `text-muted-foreground`) abaixo do `SheetHeader`. Nenhuma mudança em regras ou banco.
