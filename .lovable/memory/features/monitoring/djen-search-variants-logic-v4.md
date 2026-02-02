# Memory: features/monitoring/djen-search-variants-logic-v4
Updated: 02/02/2026

## Geração de Variantes de Busca DJEN

O monitoramento DJEN gera múltiplas variantes de busca para capturar diferentes formas de indexação pelos tribunais:

1. **Termo original** - exatamente como cadastrado
2. **Sem acentos** - versão normalizada (NFD)
3. **Sem ampersand** - substitui `&` por espaço (ex: "F & F" → "F F") para tribunais que indexam diferente
4. **Prefixo curto** - 2 primeiras palavras significativas (>= 2 chars, excluindo símbolos como &, /, \)

### Tratamento de Caracteres Especiais

Termos com `&` (comum em razões sociais) recebem tratamento especial:
- "F & F Distribuidora LTDA" gera: original, sem-acentos, "F F Distribuidora LTDA", e prefixo "DISTRIBUIDORA PRODUTOS"
- O filtro de palavras significativas exclui símbolos puros como `&`, `/`, `\` para gerar prefixos corretos

### Validação Estrita

Após a busca, publicações são validadas com 100% das palavras do termo devendo estar presentes no conteúdo. Isso evita capturas parciais (ex: apenas "Distribuidora" quando o termo completo era "F & F Distribuidora...").
