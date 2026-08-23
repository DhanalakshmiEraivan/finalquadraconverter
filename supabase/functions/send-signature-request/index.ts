import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  documentName: string;
  signerEmails: string[];
  signingOrder?: "parallel" | "sequential";
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const body = await req.json() as Body;
    const emails = [...new Set((body.signerEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!body.documentName || emails.length === 0) throw new Error("Document name and at least one signer email are required.");

    const { data: request, error: requestError } = await supabase.from("signature_requests").insert({
      owner_id: user.id,
      document_name: body.documentName,
      signer_emails: emails,
      signing_order: body.signingOrder || "sequential",
      status: "sent",
    }).select("id").single();
    if (requestError) throw requestError;

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM") || "QuadraConverter <onboarding@resend.dev>";
    const results = [];

    for (let i = 0; i < emails.length; i++) {
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const { error } = await supabase.from("signature_signers").insert({
        request_id: request.id,
        email: emails[i],
        signer_order: i + 1,
        token_hash: tokenHash,
      });
      if (error) throw error;

      const link = `${appUrl.replace(/\/$/, "")}/#/sign/${encodeURIComponent(token)}`;
      if (resendKey) {
        const email = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [emails[i]],
            subject: `Signature requested: ${body.documentName}`,
            html: `<p>You have been asked to sign <strong>${body.documentName}</strong>.</p><p><a href="${link}">Review and sign the document</a></p><p>This secure link expires in 7 days.</p>`,
          }),
        });
        results.push({ email: emails[i], emailed: email.ok });
      } else {
        results.push({ email: emails[i], emailed: false, signingLink: link });
      }
    }

    await supabase.from("signature_events").insert({
      request_id: request.id,
      actor_id: user.id,
      event_type: "request_sent",
      metadata: { signerCount: emails.length },
    });

    return new Response(JSON.stringify({ ok: true, requestId: request.id, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
