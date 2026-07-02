// ============================================================
//  Cafezal — Ricevitore webhook Tilby (chiusura giornaliera)
//  Endpoint pubblico HTTPS, gratuito, sempre attivo (Supabase Edge Function).
//  Cattura OGNI webhook Tilby grezzo in public.tilby_eventi e risponde 200.
//
//  In fase di DEPLOY:
//   • Disattiva "Verify JWT" per questa function (Tilby non manda un JWT Supabase).
//   • Imposta il secret TILBY_WEBHOOK_TOKEN col token statico che ti dà Tilby:
//       - finché è VUOTO la function accetta tutto (serve a catturare il 1° payload);
//       - appena impostato, il token diventa OBBLIGATORIO.
//  SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono iniettati in automatico.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EXPECTED_TOKEN = Deno.env.get("TILBY_WEBHOOK_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Header in ingresso: in cattura ci servono per VEDERE come Tilby manda il token.
  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers) headers[k] = v;

  // Validazione token statico Tilby (header Authorization).
  // Vuoto = fase di cattura, non blocchiamo. Impostato = obbligatorio.
  if (EXPECTED_TOKEN) {
    const auth = headers["authorization"] ?? "";
    const ok = auth === EXPECTED_TOKEN || auth === `Bearer ${EXPECTED_TOKEN}`;
    if (!ok) return new Response("Unauthorized", { status: 401 });
  }

  // Corpo grezzo: JSON se possibile, altrimenti testo.
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = { _raw_text: await req.text() };
  }

  const { error } = await supabase.from("tilby_eventi").insert({
    event_type: headers["x-entity-name"] ?? null, // best-effort, da confermare sul reale
    payload,
    headers,
  });

  if (error) {
    console.error("[tilby] insert tilby_eventi failed:", error.message);
    // 500 → Tilby ritenta (3x ogni 15 min): l'evento non si perde.
    return new Response("DB error", { status: 500 });
  }

  // 200 → Tilby considera consegnato, niente retry.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
