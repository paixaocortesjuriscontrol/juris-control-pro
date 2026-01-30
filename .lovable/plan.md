
# Plano: Adicionar Todos os Tribunais Cíveis (TJs) ao DJEN Termos

## Problema Identificado

O sistema DJEN não está encontrando publicações de vários tribunais cíveis porque **faltam tribunais na lista `TRIBUNAIS_DISPONIVEIS`**.

### Situação Atual
A lista de tribunais cíveis disponíveis contém apenas:
- TJDFT (DF)
- TJSP (São Paulo)  
- TJGO (Goiás)

### Tribunais Faltantes
Faltam **24 TJs** (todos os outros estados brasileiros):
- TJRJ, TJBA, TJRS, TJMG, TJPR, TJSC, TJPE, TJCE, TJPA, TJAM, TJMA, TJPB, TJRN, TJPI, TJSE, TJAL, TJES, TJMT, TJMS, TJTO, TJAC, TJRO, TJRR, TJAP

### Impacto
Quando o usuário marca "Todos os Tribunais Cíveis", o sistema só expande para TJDFT, TJSP e TJGO. Publicações de outros tribunais (como as do Dr. Thomás em TJRJ, TJBA, TJRS) nunca são buscadas.

---

## Solução

### Arquivo a Modificar
`src/components/djen/MonitoramentoDialog.tsx`

### Mudança
Adicionar todos os 27 Tribunais de Justiça estaduais à lista `TRIBUNAIS_DISPONIVEIS`:

```text
const TRIBUNAIS_DISPONIVEIS = [
  // Estadual (TJs) - TODOS OS 27 ESTADOS
  { id: 'TJAC', nome: 'TJAC - Tribunal de Justiça do Acre', categoria: 'Estadual' },
  { id: 'TJAL', nome: 'TJAL - Tribunal de Justiça de Alagoas', categoria: 'Estadual' },
  { id: 'TJAM', nome: 'TJAM - Tribunal de Justiça do Amazonas', categoria: 'Estadual' },
  { id: 'TJAP', nome: 'TJAP - Tribunal de Justiça do Amapá', categoria: 'Estadual' },
  { id: 'TJBA', nome: 'TJBA - Tribunal de Justiça da Bahia', categoria: 'Estadual' },
  { id: 'TJCE', nome: 'TJCE - Tribunal de Justiça do Ceará', categoria: 'Estadual' },
  { id: 'TJDFT', nome: 'TJDFT - Tribunal de Justiça do DF', categoria: 'Estadual' },
  { id: 'TJES', nome: 'TJES - Tribunal de Justiça do Espírito Santo', categoria: 'Estadual' },
  { id: 'TJGO', nome: 'TJGO - Tribunal de Justiça de Goiás', categoria: 'Estadual' },
  { id: 'TJMA', nome: 'TJMA - Tribunal de Justiça do Maranhão', categoria: 'Estadual' },
  { id: 'TJMG', nome: 'TJMG - Tribunal de Justiça de Minas Gerais', categoria: 'Estadual' },
  { id: 'TJMS', nome: 'TJMS - Tribunal de Justiça de Mato Grosso do Sul', categoria: 'Estadual' },
  { id: 'TJMT', nome: 'TJMT - Tribunal de Justiça de Mato Grosso', categoria: 'Estadual' },
  { id: 'TJPA', nome: 'TJPA - Tribunal de Justiça do Pará', categoria: 'Estadual' },
  { id: 'TJPB', nome: 'TJPB - Tribunal de Justiça da Paraíba', categoria: 'Estadual' },
  { id: 'TJPE', nome: 'TJPE - Tribunal de Justiça de Pernambuco', categoria: 'Estadual' },
  { id: 'TJPI', nome: 'TJPI - Tribunal de Justiça do Piauí', categoria: 'Estadual' },
  { id: 'TJPR', nome: 'TJPR - Tribunal de Justiça do Paraná', categoria: 'Estadual' },
  { id: 'TJRJ', nome: 'TJRJ - Tribunal de Justiça do Rio de Janeiro', categoria: 'Estadual' },
  { id: 'TJRN', nome: 'TJRN - Tribunal de Justiça do Rio Grande do Norte', categoria: 'Estadual' },
  { id: 'TJRO', nome: 'TJRO - Tribunal de Justiça de Rondônia', categoria: 'Estadual' },
  { id: 'TJRR', nome: 'TJRR - Tribunal de Justiça de Roraima', categoria: 'Estadual' },
  { id: 'TJRS', nome: 'TJRS - Tribunal de Justiça do Rio Grande do Sul', categoria: 'Estadual' },
  { id: 'TJSC', nome: 'TJSC - Tribunal de Justiça de Santa Catarina', categoria: 'Estadual' },
  { id: 'TJSE', nome: 'TJSE - Tribunal de Justiça de Sergipe', categoria: 'Estadual' },
  { id: 'TJSP', nome: 'TJSP - Tribunal de Justiça de São Paulo', categoria: 'Estadual' },
  { id: 'TJTO', nome: 'TJTO - Tribunal de Justiça de Tocantins', categoria: 'Estadual' },
  // ... mantém Federal, Superior e Trabalhista
  { id: 'TODOS_CIVEIS', nome: 'Todos os Tribunais Cíveis (27 TJs)', categoria: 'Estadual' },
];
```

---

## Ação Pós-Implementação

Após a implementação, será necessário **editar os monitoramentos existentes** do Dr. Thomás que usam `TODOS_CIVEIS` e salvá-los novamente para que expandam para os 27 tribunais.

### Monitoramentos Afetados (Coordenação Dr. Thomás)
Os monitoramentos que atualmente têm `tribunais: [TJSP]` ou `tribunais: [TJDFT, TJSP, TJGO]` precisarão ser atualizados para incluir todos os cíveis.

---

## Resumo Técnico

| Item | Detalhe |
|------|---------|
| Arquivo | `src/components/djen/MonitoramentoDialog.tsx` |
| Linhas afetadas | 24-63 (lista TRIBUNAIS_DISPONIVEIS) |
| Tribunais adicionados | 24 (todos os TJs faltantes) |
| Impacto | "Todos os Tribunais Cíveis" passará a incluir 27 TJs |
