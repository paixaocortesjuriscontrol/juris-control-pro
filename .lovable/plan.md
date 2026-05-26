## Mudança

Na busca DJEN Termos Paralela, hoje os cards de progresso por tribunal aparecem empilhados (1 por linha), ocupando muito espaço quando há 20+ tribunais.

## O que vai mudar

Em `src/components/configuracoes/MonitoramentoTermosParalelaCard.tsx` (linhas ~538-630), trocar o container `space-y-2` que envolve `progress.tracks.map(...)` por um grid responsivo:

- Mobile (<768 px): 1 card por linha
- Tablet (768-1279 px): 2 cards por linha  
- Desktop (≥1280 px): **3 cards por linha**

Manter o `max-h-[600px] overflow-y-auto` e o cabeçalho sticky "Tribunais (N)".

## Detalhe técnico

Substituir:
```tsx
<div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
  <h4 ...sticky>Tribunais (...)</h4>
  {progress.tracks.map(...)}
</div>
```

Por:
```tsx
<div className="max-h-[600px] overflow-y-auto pr-1">
  <h4 ...sticky>Tribunais (...)</h4>
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
    {progress.tracks.map(...)}
  </div>
</div>
```

Nada mais é alterado — conteúdo do card, cores, badges e barras de progresso seguem iguais.
