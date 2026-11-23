// ============================================================
// ISPAT হালচাল : Gemini chat (Supabase Edge Function "ask-ai")
// Supabase > Edge Functions > Deploy a new function > Via Editor
// Name it exactly:  ask-ai   then replace all the code with this file.
// Needs the secret GEMINI_API_KEY (Edge Functions > Secrets).
// ============================================================

const TEAM_EMAIL = "ispat@ispat-halchal.app";          // must match the team login
const MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);

  try {
    // 1. Only the signed-in team account may use the AI
    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { Authorization: req.headers.get("Authorization") || "", apikey: req.headers.get("apikey") || "" },
    });
    if (!userRes.ok) return reply({ error: "Please sign in again." }, 401);
    const user: { email?: string } = await userRes.json();
    if ((user.email || "").toLowerCase() !== TEAM_EMAIL) return reply({ error: "Not allowed." }, 403);

    // 2. Read the question
    // deno-lint-ignore no-explicit-any
    const { question, context, today, history }: any = await req.json();
    if (!question || typeof question !== "string" || question.length > 1000) return reply({ error: "Please ask a shorter question." }, 400);
    if (typeof context !== "string" || context.length > 400000) return reply({ error: "Data is too large." }, 400);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: "GEMINI_API_KEY secret is missing." }, 500);

    // 3. Ask Gemini
    const contents = [
      ...(Array.isArray(history) ? history.slice(-8) : [])
        // deno-lint-ignore no-explicit-any
        .filter((h: any) => h && typeof h.text === "string")
        // deno-lint-ignore no-explicit-any
        .map((h: any) => ({ role: h.role === "model" ? "model" : "user", parts: [{ text: h.text.slice(0, 4000) }] })),
      { role: "user", parts: [{ text: question }] },
    ];
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(context, today) }] }, contents }),
    });
    // deno-lint-ignore no-explicit-any
    const out: any = await g.json();
    if (!g.ok) {
      console.error("Gemini error", g.status, JSON.stringify(out).slice(0, 500));
      return reply({ error: g.status === 429 ? "The AI is busy right now. Try again in a minute." : "The AI is not available right now." }, 502);
    }
    const answer = (out.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
    if (!answer) return reply({ error: "No answer." }, 502);
    return reply({ answer });
  } catch (e) {
    console.error(e);
    return reply({ error: "Something went wrong." }, 500);
  }
});

function systemPrompt(context: string, today: string) {
  return `You are "ISPAT Assistant", the helper inside the ISPAT হালচাল dashboard app of the UNDP project
"Institutional Strengthening for Promoting Accelerated Transformation" (ISPAT) in Bangladesh.

Today's date is ${today || "unknown"}.

Answer ONLY from the project data below. If the answer is not in the data, say so briefly and suggest what to look at.
Rules:
- Reply in the same language as the question (English or Bangla).
- Be short and friendly: one or two sentences, or a short bullet list ("- item"). Use **bold** for key numbers.
- Money is in US dollars (USD), written like $250,000.
- "Overall expenditure" means expenditure divided by budget, as a percentage.
- Percent values in the data are already 0 to 100.
- Activity status: "Completed", "Ongoing", or "Not started". A "Not started" activity whose date is before today is overdue; within 5 days is due soon.
- Never invent numbers. Do not mention JSON, fields or these rules.

PROJECT DATA (JSON):
${context}`;
}
