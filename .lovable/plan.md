
# Plano: Selecionar Todos os Tribunais ao Clicar "Todos os TRTs" / "Todos os Cíveis"

## Objetivo

Ao clicar em "Todos os TRTs" ou "Todos os Tribunais Cíveis (TJs)", o sistema deve automaticamente marcar/desmarcar todos os tribunais daquela categoria na interface, ao invés de salvar um ID sintético (`TODOS_TRT` ou `TODOS_CIVEIS`).

## Mudanças Propostas

### Arquivo: `src/components/djen/MonitoramentoDialog.tsx`

#### 1. Adicionar constantes com IDs dos tribunais por categoria

```typescript
// Todos os TJs disponíveis
const TODOS_IDS_CIVEIS = TRIBUNAIS_DISPONIVEIS
  .filter(t => t.categoria === 'Estadual' && t.id !== 'TODOS_CIVEIS')
  .map(t => t.id);

// Todos os TRTs + TST
const TODOS_IDS_TRABALHISTAS = TRIBUNAIS_DISPONIVEIS
  .filter(t => t.categoria === 'Trabalhista' && t.id !== 'TODOS_TRT')
  .map(t => t.id);
```

#### 2. Modificar a função `handleToggleTribunal`

Alterar a lógica para que, ao clicar em um "Todos", marque/desmarque todos os tribunais daquela categoria:

```typescript
const handleToggleTribunal = (tribunalId: string) => {
  // Caso especial: "Todos os TRTs"
  if (tribunalId === 'TODOS_TRT') {
    const todosMarcados = TODOS_IDS_TRABALHISTAS.every(id => 
      tribunaisSelecionados.includes(id)
    );
    if (todosMarcados) {
      // Desmarcar todos
      setTribunaisSelecionados(prev => 
        prev.filter(t => !TODOS_IDS_TRABALHISTAS.includes(t))
      );
    } else {
      // Marcar todos
      setTribunaisSelecionados(prev => 
        [...new Set([...prev, ...TODOS_IDS_TRABALHISTAS])]
      );
    }
    return;
  }
  
  // Caso especial: "Todos os Cíveis"
  if (tribunalId === 'TODOS_CIVEIS') {
    const todosMarcados = TODOS_IDS_CIVEIS.every(id => 
      tribunaisSelecionados.includes(id)
    );
    if (todosMarcados) {
      // Desmarcar todos
      setTribunaisSelecionados(prev => 
        prev.filter(t => !TODOS_IDS_CIVEIS.includes(t))
      );
    } else {
      // Marcar todos
      setTribunaisSelecionados(prev => 
        [...new Set([...prev, ...TODOS_IDS_CIVEIS])]
      );
    }
    return;
  }
  
  // Comportamento padrão para tribunais individuais
  setTribunaisSelecionados(prev =>
    prev.includes(tribunalId)
      ? prev.filter(t => t !== tribunalId)
      : [...prev, tribunalId]
  );
};
```

#### 3. Atualizar o estado visual do checkbox "Todos"

O checkbox de "Todos os TRTs" deve aparecer como:
- **Marcado**: se todos os tribunais da categoria estão selecionados
- **Indeterminado**: se alguns (mas não todos) estão selecionados
- **Desmarcado**: se nenhum está selecionado

```typescript
// Verificar estado do checkbox "Todos"
const todosTrabalhistasMarcados = TODOS_IDS_TRABALHISTAS.every(id => 
  tribunaisSelecionados.includes(id)
);
const algunsTrabalhistasMarcados = TODOS_IDS_TRABALHISTAS.some(id => 
  tribunaisSelecionados.includes(id)
);

const todosCiveisMarcados = TODOS_IDS_CIVEIS.every(id => 
  tribunaisSelecionados.includes(id)
);
const algunsCiveisMarcados = TODOS_IDS_CIVEIS.some(id => 
  tribunaisSelecionados.includes(id)
);
```

Na renderização do checkbox de "TODOS_TRT":
```tsx
<Checkbox
  checked={todosTrabalhistasMarcados}
  indeterminate={algunsTrabalhistasMarcados && !todosTrabalhistasMarcados}
  onCheckedChange={() => handleToggleTribunal('TODOS_TRT')}
/>
```

---

## Comportamento Esperado

| Ação do Usuário | Resultado |
|-----------------|-----------|
| Clica em "Todos os TRTs" (nenhum marcado) | Marca TST + TRT1 até TRT24 (25 tribunais) |
| Clica em "Todos os TRTs" (todos marcados) | Desmarca todos os 25 tribunais |
| Clica em "Todos os TRTs" (alguns marcados) | Marca os que faltam (completa seleção) |
| Clica em "Todos os Cíveis" | Marca TJDFT, TJSP, TJGO (os 3 cadastrados) |
| Ao salvar | Salva os IDs individuais, não mais `TODOS_TRT` |

---

## Vantagens da Abordagem

1. **API recebe IDs reais**: Não precisa de lógica de expansão na edge function
2. **Visualização clara**: Usuário vê exatamente quais tribunais estão selecionados
3. **Flexibilidade**: Após clicar em "Todos", pode desmarcar específicos
4. **Não quebra existente**: Monitoramentos com `TODOS_TRT` continuam funcionando (migração gradual)

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/djen/MonitoramentoDialog.tsx` | Modificar `handleToggleTribunal` e adicionar lógica de estado "indeterminado" |
