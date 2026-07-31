// Links para o app (usados nos alertas por e-mail/WhatsApp).
// O destino é o Painel de Controle na visão "Alertas". Se o usuário não estiver
// logado, o ProtectedRoute redireciona para /auth e depois retorna para esta URL.
const APP_URL = (Deno.env.get("APP_URL") ?? "https://juriscontrol.adv.br").replace(/\/+$/, "");

export function linkPainelAlertas(itemId?: string | null): string {
  const base = `${APP_URL}/painel-controle?view=notificacoes`;
  return itemId ? `${base}&item=${encodeURIComponent(itemId)}` : base;
}

export function botaoPainelAlertasHtml(itemId?: string | null, label = "Visualizar no sistema"): string {
  const url = linkPainelAlertas(itemId);
  return `<div style="margin:20px 0;text-align:center">
  <a href="${url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px">${label}</a>
  <div style="color:#6B7280;font-size:11px;margin-top:8px">Se não estiver logado, faça login e você será levado direto ao detalhe.</div>
</div>`;
}

export function linhaPainelAlertasTexto(itemId?: string | null): string {
  return `Visualizar no sistema: ${linkPainelAlertas(itemId)}`;
}
