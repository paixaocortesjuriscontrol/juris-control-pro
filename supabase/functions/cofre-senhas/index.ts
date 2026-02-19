import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENCRYPTION_KEY = Deno.env.get("COFRE_ENCRYPTION_KEY") ?? "";

// Simple symmetric encryption using AES-GCM via WebCrypto
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

async function encrypt(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(ENCRYPTION_KEY);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Combine iv + encrypted, encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertext: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const key = await deriveKey(ENCRYPTION_KEY);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...body } = await req.json();

    if (action === "salvar") {
      // Encrypt sensitive fields before saving
      const { id, senha, certificado_a1_senha, ...rest } = body;

      const updates: Record<string, unknown> = { ...rest };

      if (senha) {
        updates.senha_hash = await encrypt(senha);
      }
      if (certificado_a1_senha) {
        updates.certificado_a1_senha = await encrypt(certificado_a1_senha);
      }

      let result;
      if (id) {
        // Update
        result = await supabase
          .from("cofre_senhas")
          .update(updates)
          .eq("id", id)
          .eq("usuario_id", user.id)
          .select()
          .single();
      } else {
        // Insert
        result = await supabase
          .from("cofre_senhas")
          .insert({ ...updates, usuario_id: user.id, aceite_termos_em: new Date().toISOString() })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Return without sensitive fields
      const { senha_hash: _sh, certificado_a1_senha: _cs, ...safe } = result.data;
      return new Response(JSON.stringify({ success: true, data: safe }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "obter_senha") {
      // Only used internally by other edge functions - returns decrypted password
      const { cofre_senha_id } = body;

      const { data, error } = await supabase
        .from("cofre_senhas")
        .select("senha_hash, certificado_a1_senha, login, sistema, tribunal")
        .eq("id", cofre_senha_id)
        .single();

      if (error) throw error;

      const decrypted: Record<string, string | null> = {
        login: data.login,
        sistema: data.sistema,
        tribunal: data.tribunal,
        senha: null,
        certificado_a1_senha: null,
      };

      if (data.senha_hash) {
        try {
          decrypted.senha = await decrypt(data.senha_hash);
        } catch {
          // Plaintext fallback (for existing records before encryption)
          decrypted.senha = data.senha_hash;
        }
      }

      if (data.certificado_a1_senha) {
        try {
          decrypted.certificado_a1_senha = await decrypt(data.certificado_a1_senha);
        } catch {
          decrypted.certificado_a1_senha = data.certificado_a1_senha;
        }
      }

      return new Response(JSON.stringify({ success: true, data: decrypted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "migrar_senhas_plaintext") {
      // One-time migration: encrypt all existing plaintext passwords
      // Only admins can run this
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if ((profile as any)?.role !== "admin") {
        // Check is_admin_or_coordenador
        const { data: isAdmin } = await supabase.rpc("is_admin_or_coordenador", { _user_id: user.id });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: credenciais } = await supabase
        .from("cofre_senhas")
        .select("id, senha_hash, certificado_a1_senha");

      let migrated = 0;
      for (const cred of credenciais ?? []) {
        const updates: Record<string, string> = {};

        // Check if already encrypted (base64 AES-GCM output)
        const isEncrypted = (s: string) => {
          try {
            const decoded = atob(s);
            return decoded.length > 12; // must have at least IV (12 bytes)
          } catch {
            return false;
          }
        };

        if (cred.senha_hash && !isEncrypted(cred.senha_hash)) {
          updates.senha_hash = await encrypt(cred.senha_hash);
        }
        if (cred.certificado_a1_senha && !isEncrypted(cred.certificado_a1_senha)) {
          updates.certificado_a1_senha = await encrypt(cred.certificado_a1_senha);
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from("cofre_senhas").update(updates).eq("id", cred.id);
          migrated++;
        }
      }

      return new Response(JSON.stringify({ success: true, migrated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cofre-senhas error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
