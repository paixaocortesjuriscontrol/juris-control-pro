import { createHash } from "node:crypto";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildKurierAuthHeaders,
  buildKurierUrl,
  corsHeaders,
  decryptKurier,
  getKurierBaseUrlFromDb,
  jsonResponse,
} from "../_kurier-shared/crypto.ts";
import {
  conteudoContemTermoOuOr,
  shouldExclude,
  type Monitoramento,
} from "../_kurier-shared/djenMatch.ts";

// Consome publicações pendentes de UMA credencial Kurier em lotes de 50.
// Persiste em kurier_publicacoes_raw (idempotente por id_kurier) e em
// publicacoes_djen (origem='kurier'). Confirma o lote para tirar da fila.
//
// Body: { credencial_id: uuid, max_lotes?: number (default 20) }

interface KurierPub {
  id?: string | number;
  Id?: string | number;
  idPublicacao?: string | number;
  numero_processo?: string;
  NumeroProcesso?: string;
  conteudo?: string;
  Conteudo?: string;
  data_disponibilizacao?: string;
  DataDisponibilizacao?: string;
  data_publicacao?: string;
  DataPublicacao?: string;
  tribunal?: string;
  Tribunal?: string;
  diario?: string;
  Diario?: string;
  termo?: string;
  Termo?: string;
  [k: string]: any;
}

function pickId(p: KurierPub): string | null {
  const raw = p.id ?? p.Id ?? p.idPublicacao ?? p.IdPublicacao;
  if (raw === undefined || raw === null || raw === "") return null;
  return String(raw);
}

function pickStr(p: KurierPub, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = (p as any)[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function normalizeProcesso(n: string | null): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  return digits.length >= 15 ? digits : n;
}

const LOTE_SIZE = 50;
const DELAY_MS = 800;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "coordenador");
    if (!allowed) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const credencial_id: string | undefined = body.credencial_id;
    const max_lotes: number = Math.min(100, Math.max(1, Number(body.max_lotes ?? 20)));
    const monitoramento_ids: string[] | undefined = Array.isArray(body.monitoramento_ids)
      ? body.monitoramento_ids.filter((x: any) => typeof x === "string" && x)
      : undefined;
    const coordenacao_id: string | undefined = typeof body.coordenacao_id === "string" && body.coordenacao_id
      ? body.coordenacao_id : undefined;
    if (!credencial_id) return jsonResponse({ error: "credencial_id obrigatório" }, 400);

    const { data: cred, error: credErr } = await admin
      .from("kurier_credenciais")
      .select("id, login, senha_encrypted, ativo")
      .eq("id", credencial_id)
      .maybeSingle();
    if (credErr || !cred) return jsonResponse({ error: "Credencial não encontrada" }, 404);
    if (!cred.senha_encrypted) return jsonResponse({ error: "Credencial sem senha" }, 400);

    const senha = await decryptKurier(cred.senha_encrypted);
    const baseUrl = await getKurierBaseUrlFromDb(admin);

    // Carrega monitoramentos ativos para aplicar os termos do DJEN nas publicações
    // recebidas via Kurier. Sem monitoramento que case, a publicação é descartada
    // (consumida na fila, mas não persistida em publicacoes_djen).
    let monitQuery = admin
      .from("monitoramentos_djen")
      .select("id, tipo, termo_busca, oab, uf, exclusoes, condicao_concomitante, termos_or, descricao, buscar_parte, coordenacao_id, criado_por")
      .eq("ativo", true);
    if (monitoramento_ids?.length) monitQuery = monitQuery.in("id", monitoramento_ids);
    if (coordenacao_id) monitQuery = monitQuery.eq("coordenacao_id", coordenacao_id);
    const { data: monitsRaw } = await monitQuery;
    const monitoramentos: (Monitoramento & { coordenacao_id?: string | null })[] = (monitsRaw ?? []) as any;
    console.log(`[kurier] monitoramentos carregados: ${monitoramentos.length}`);

    // Registra execução
    const { data: execIns } = await admin
      .from("kurier_execucoes")
      .insert({
        credencial_id: cred.id,
        login_usado: cred.login,
        lote: "consulta",
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    const execId = execIns?.id;

    let totalRecebidas = 0;
    let totalNovas = 0;
    let totalDuplicadas = 0;
    let totalConfirmadas = 0;
    let totalDescartadas = 0;
    let ultimoErro: string | null = null;
    let lotesProcessados = 0;

    for (let lote = 0; lote < max_lotes; lote++) {
      const url = buildKurierUrl(baseUrl, "/api/KJuridico/ConsultarPublicacoes", {
      });

      let resp: Response;
      let texto = "";
      try {
        resp = await fetch(url, { method: "GET", headers: buildKurierAuthHeaders(cred.login, senha) });
        texto = await resp.text();
      } catch (e) {
        ultimoErro = `Falha rede lote ${lote}: ${String(e)}`;
        break;
      }
      if (resp.status < 200 || resp.status >= 300) {
        ultimoErro = resp.status === 401
          ? "HTTP 401 — login ou senha recusados pela Kurier"
          : `HTTP ${resp.status} lote ${lote}: ${texto.trim() ? texto.slice(0, 200) : "resposta sem mensagem"}`;
        break;
      }

      let pubs: KurierPub[] = [];
      try {
        const j = JSON.parse(texto);
        pubs = Array.isArray(j) ? j : (j?.publicacoes ?? j?.Publicacoes ?? j?.items ?? []);
      } catch (e) {
        ultimoErro = `JSON inválido lote ${lote}: ${texto.slice(0, 200)}`;
        break;
      }

      if (!pubs.length) break; // Sem mais publicações pendentes

      lotesProcessados++;
      totalRecebidas += pubs.length;
      const idsConfirmar: string[] = [];

      for (const p of pubs) {
        const idK = pickId(p);
        if (!idK) { totalDescartadas++; continue; }

        // Idempotência: se já existe em raw, é duplicada (já foi processada antes).
        const { data: existente } = await admin
          .from("kurier_publicacoes_raw")
          .select("id, publicacao_djen_id")
          .eq("id_kurier", idK)
          .maybeSingle();

        if (existente) {
          totalDuplicadas++;
          idsConfirmar.push(idK);
          continue;
        }

        const numero = normalizeProcesso(pickStr(p, "numero_processo", "NumeroProcesso", "processo", "Processo"));
        const conteudo = pickStr(p, "conteudo", "Conteudo", "texto", "Texto");
        const dataDisp = pickStr(p, "data_disponibilizacao", "DataDisponibilizacao", "dataDisponibilizacao");
        const dataPub = pickStr(p, "data_publicacao", "DataPublicacao", "dataPublicacao");
        const tribunal = pickStr(p, "tribunal", "Tribunal", "siglaTribunal");

        let publicacaoDjenId: string | null = null;

        if (numero && conteudo) {
          // 1) Matching contra monitoramentos DJEN (mesma lógica do monitorar-djen)
          let matched: (Monitoramento & { coordenacao_id?: string | null }) | null = null;
          for (const m of monitoramentos) {
            try {
              if (!conteudoContemTermoOuOr(conteudo, m as Monitoramento)) continue;
              const motivo = shouldExclude(conteudo, m.exclusoes || [], null, null);
              if (motivo) continue;
              matched = m;
              break;
            } catch (e) {
              console.warn(`[kurier] erro matching monit ${m.id}:`, String(e));
            }
          }

          if (!matched) {
            totalDescartadas++;
          } else {
            const hashConteudo = sha256(`${numero}|${dataDisp ?? dataPub ?? ""}|${conteudo}`);
            const digits = numero.replace(/\D/g, "");

            // 2) Dedup: se já existe publicação com mesmo hash, conta como duplicada
            const { data: jaExiste } = await admin
              .from("publicacoes_djen")
              .select("id")
              .eq("hash_conteudo", hashConteudo)
              .maybeSingle();

            if (jaExiste) {
              publicacaoDjenId = jaExiste.id;
              totalDuplicadas++;
            } else {
              const payload: any = {
                monitoramento_id: matched.id,
                coordenacao_id: matched.coordenacao_id ?? null,
                processo_numero: numero,
                conteudo,
                fonte: "kurier",
                hash_conteudo: hashConteudo,
                dedup_processo_digits: digits || null,
                dedup_data_ref: (dataDisp ?? dataPub ?? "").slice(0, 10) || null,
                tribunal,
                data_disponibilizacao: dataDisp ?? null,
                data_publicacao: dataPub ?? null,
                tipo_publicacao: "intimacao",
              };

              const { data: insPub, error: pubErr } = await admin
                .from("publicacoes_djen")
                .insert(payload)
                .select("id")
                .maybeSingle();

              if (pubErr) {
                console.warn("[kurier] erro insert publicacoes_djen:", pubErr.message);
                totalDuplicadas++;
              } else if (insPub) {
                publicacaoDjenId = insPub.id;
                totalNovas++;
              }
            }
          }
        } else {
          totalDescartadas++;
        }

        // Grava raw após tentar inserir publicacoes_djen
        await admin
          .from("kurier_publicacoes_raw")
          .insert({
            id_kurier: idK,
            credencial_id: cred.id,
            login_usado: cred.login,
            payload: p as any,
            publicacao_djen_id: publicacaoDjenId,
            recebida_em: new Date().toISOString(),
          });

        idsConfirmar.push(idK);
      }

      // Confirma o lote
      if (idsConfirmar.length) {
        try {
          const confirmUrl = buildKurierUrl(baseUrl, "/api/KJuridico/ConfirmarPublicacoes", {
          });
          const cResp = await fetch(confirmUrl, {
            method: "POST",
            headers: buildKurierAuthHeaders(cred.login, senha, { "Content-Type": "application/json" }),
            body: JSON.stringify(idsConfirmar.map((id) => ({ id }))),
          });
          if (cResp.ok) {
            totalConfirmadas += idsConfirmar.length;
            await admin
              .from("kurier_publicacoes_raw")
              .update({ confirmada: true, confirmada_em: new Date().toISOString() })
              .in("id_kurier", idsConfirmar);
          } else {
            ultimoErro = `Falha confirmacao HTTP ${cResp.status}`;
          }
        } catch (e) {
          ultimoErro = `Falha confirmacao: ${String(e)}`;
        }
      }

      if (pubs.length < LOTE_SIZE) break; // último lote
      await delay(DELAY_MS);
    }

    await admin
      .from("kurier_credenciais")
      .update({
        ultimo_uso: new Date().toISOString(),
        ultimo_status: ultimoErro
          ? `Erro: ${ultimoErro.slice(0, 120)}`
          : `OK (${totalNovas} novas, ${totalDuplicadas} dup, ${totalConfirmadas} confirm)`,
      })
      .eq("id", cred.id);

    if (execId) {
      await admin
        .from("kurier_execucoes")
        .update({
          total_recebidas: totalRecebidas,
          total_novas: totalNovas,
          total_duplicadas: totalDuplicadas,
          total_descartadas: totalDescartadas,
          total_confirmadas: totalConfirmadas,
          erro: ultimoErro,
          metadata: { lotes_processados: lotesProcessados },
          finalizado_em: new Date().toISOString(),
        })
        .eq("id", execId);
    }

    return jsonResponse({
      ok: !ultimoErro,
      credencial_id: cred.id,
      login: cred.login,
      lotes_processados: lotesProcessados,
      total_recebidas: totalRecebidas,
      total_novas: totalNovas,
      total_duplicadas: totalDuplicadas,
      total_descartadas: totalDescartadas,
      total_confirmadas: totalConfirmadas,
      erro: ultimoErro,
    });
  } catch (e) {
    return jsonResponse({ error: String(e?.message ?? e) }, 500);
  }
});