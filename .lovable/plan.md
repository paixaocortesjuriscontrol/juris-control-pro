# Reverter DJEN Termos Paralela ao estado anterior

## Diagnóstico

O motor `useDjenTermosParalelaEngine.ts` **não foi alterado hoje**. O que mudou foram apenas os arquivos do **pool de proxy multi-IP** (consumido pela Paralela):

- `src/utils/djenProxyPool.ts` — última versão estável: commit `1cd3a5046`
- `src/components/configuracoes/PoolProxyDjenCard.tsx` — última versão estável: commit `169ed2c72`
- `gcp-djen-proxy/` (server.js, README.md, setup-vm06.sh) — pasta inteira criada hoje, não existia antes

Esses 3 itens são responsáveis pela complicação (VM multi-IP, slots manuais, etc). Revertendo eles, a Paralela volta a funcionar exatamente como estava antes da sessão de hoje.

## Ações

1. Restaurar `src/utils/djenProxyPool.ts` para o blob de `1cd3a5046`.
2. Restaurar `src/components/configuracoes/PoolProxyDjenCard.tsx` para o blob de `169ed2c72`.
3. Deletar a pasta `gcp-djen-proxy/` inteira (criada hoje).
4. **Não tocar** em:
   - `src/hooks/useDjenTermosParalelaEngine.ts`
   - `src/hooks/useDjenTermosParalela.ts`
   - `src/utils/pjeComunicaClient.ts`
   - VM/IPs no GCP (você cuida disso fora do código quando quiser)

## Fora de escopo

- Não vou mexer em nada da infraestrutura GCP (VMs, IPs reservados).  
- Se você ainda tiver IPs reservados (`djen-vm01-ip-2..5`) e quiser apagar, rode quando quiser:  
  `gcloud compute addresses delete djen-vm01-ip-2 djen-vm01-ip-3 djen-vm01-ip-4 djen-vm01-ip-5 --region=southamerica-east1 --quiet`

Confirma que posso executar essa reversão?
