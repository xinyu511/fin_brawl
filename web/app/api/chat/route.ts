    import { NextResponse } from "next/server";
    import { z } from "zod";
    import { llmComplete } from "@/lib/llm";
    import { supabaseAdmin } from "@/lib/supabaseAdmin";

    const Body = z.object({
      user_id: z.string().uuid().nullable(),
      message: z.string().min(1),
      finance: z.object({
        monthlyIncome: z.number().nonnegative(),
        fixedCosts: z.number().nonnegative()
      }).optional()
    });

    // 1) Intent router prompt
    const INTENT_SYSTEM = `You are an intent router for a budgeting app.
Return ONLY JSON: {"intent":"create_transaction"|"affordability"|"summary"|"city","confidence":0-1,"fields":{...}}.
- create_transaction: user states they spent money.
- affordability: user asks if they can afford a one-time purchase/trip.
- summary: user asks why overspending, what to cut, monthly summary.
- city: user asks which city to live in / cost of living.`;

    // 2) For create_transaction, extract minimal fields from text
    const CREATE_SYSTEM = `Extract a transaction from the user's message.
Return ONLY JSON: {"merchant":string,"date":"YYYY-MM-DD","amount":number,"category":string|null}. 
If date not explicit, use today's date. Merchant can be a guess ("Uber", "Coffee").`;

    // 3) Response style (explanation)
    const ANSWER_SYSTEM = `You are a helpful financial coach. Be supportive, not judgmental.
Explain clearly in 4-8 short sentences. Provide 2 actionable suggestions when relevant.`;

    function todayISO() {
      const d = new Date();
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${d.getFullYear()}-${mm}-${dd}`;
    }

    async function sumLast30Days(user_id: string) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffISO = cutoff.toISOString().slice(0,10);

      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select("amount,date,merchant,category,source")
        .eq("user_id", user_id)
        .gte("date", cutoffISO);

      if (error) throw new Error(error.message);
      const txs = (data ?? []) as any[];
      const total = txs.reduce((acc, t) => acc + Number(t.amount), 0);
      return { total, txs, cutoffISO };
    }

    export async function POST(req: Request) {
      try {
        const body = Body.parse(await req.json());
        const message = body.message;
        const user_id = body.user_id;
        const modelText = process.env.DEDALUS_API_KEY
          ? (process.env.DEDALUS_MODEL_TEXT || "openai/gpt-4o-mini")
          : (process.env.OPENAI_MODEL_TEXT || "gpt-4.1-mini");

        // If not logged in, still respond, but no DB access.
        if (!user_id) {
          return NextResponse.json({ reply: "Please login first so I can read your transactions and do real math. Go to /login." });
        }

        // Intent routing
        const intentResp = await llmComplete({
          model: modelText,
          input: [
            { role: "system", content: [{ type: "input_text", text: INTENT_SYSTEM }] },
            { role: "user", content: [{ type: "input_text", text: message }] }
          ]
        });

        const intentText: string =
          intentResp?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ?? "";

        let routed: any;
        try {
          routed = JSON.parse(intentText);
        } catch {
          const m = intentText.match(/\{[\s\S]*\}/);
          routed = m ? JSON.parse(m[0]) : { intent: "summary", confidence: 0.3, fields: {} };
        }

        const intent = routed.intent as string;

        // --- create_transaction ---
        if (intent === "create_transaction") {
          const createResp = await llmComplete({
            model: modelText,
            input: [
              { role: "system", content: [{ type: "input_text", text: CREATE_SYSTEM }] },
              { role: "user", content: [{ type: "input_text", text: `Today is ${todayISO()}. User message: ${message}` }] }
            ]
          });

          const txText: string =
            createResp?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ?? "";

          let tx: any;
          try { tx = JSON.parse(txText); }
          catch {
            const m = txText.match(/\{[\s\S]*\}/);
            if (!m) throw new Error("Could not parse transaction JSON");
            tx = JSON.parse(m[0]);
          }

          const Tx = z.object({
            merchant: z.string().min(1),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            amount: z.number(),
            category: z.string().nullable().optional()
          });
          const parsed = Tx.parse(tx);

          const { error } = await supabaseAdmin.from("transactions").insert({
            user_id,
            date: parsed.date,
            merchant: parsed.merchant,
            amount: parsed.amount,
            category: parsed.category ?? null,
            source: "chat",
            receipt_url: null
          });
          if (error) throw new Error(error.message);

          return NextResponse.json({
            created_transaction: true,
            reply: `Logged: $${parsed.amount.toFixed(2)} at ${parsed.merchant} on ${parsed.date}.`
          });
        }

        // --- affordability ---
        if (intent === "affordability") {
          // very simple amount extraction (fallback)
          const amountMatch = message.replace(/,/g,"").match(/\$\s*(\d+(?:\.\d+)?)/);
          const target = amountMatch ? Number(amountMatch[1]) : 0;

          const { total: last30Spend, cutoffISO } = await sumLast30Days(user_id);
          const income = body.finance?.monthlyIncome ?? 0;
          const fixed = body.finance?.fixedCosts ?? 0;
          const estMonthly = last30Spend; // proxy
          const freeCash = income - fixed - estMonthly;

          const can = target > 0 ? (freeCash >= target) : (freeCash >= 0);

          const explain = await llmComplete({
            model: modelText,
            input: [
              { role: "system", content: [{ type: "input_text", text: ANSWER_SYSTEM }] },
              { role: "user", content: [{ type: "input_text", text:
                `User asked: ${message}
Numbers:
- last_30_days_spend (since ${cutoffISO}): ${last30Spend.toFixed(2)}
- monthly_income: ${income.toFixed(2)}
- fixed_costs: ${fixed.toFixed(2)}
- estimated_monthly_variable_spend: ${estMonthly.toFixed(2)}
- free_cash = income - fixed - estimated = ${freeCash.toFixed(2)}
Decision: ${can ? "YES" : "NO"} (target=${target.toFixed(2)})

Explain the decision and give 2 practical options.`
              }] }
            ]
          });

          const reply: string =
            explain?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
            `Decision: ${can ? "Yes" : "No"}. Free cash: ${freeCash.toFixed(2)}.`;

          return NextResponse.json({ reply });
        }

        // --- city ---
        if (intent === "city") {
          // TODO: integrate a dataset (Numbeo, HUD, etc). For hackathon, provide a structured set of questions.
          const reply = `I can help with city choice, but I need a bit more info:
1) Your monthly income range?
2) Must-have city (or region/time zone)?
3) Biggest costs: rent vs food vs transit?
If you want a data-backed answer, plug in a cost-of-living dataset (TODO in code) and I’ll compare rent + transit + typical expenses.`;
          return NextResponse.json({ reply });
        }

        // --- summary (default) ---
        const { total: last30Spend, txs, cutoffISO } = await sumLast30Days(user_id);

        // Simple “what to cut first” heuristic: top merchants in last 30 days
        const byMerchant = new Map<string, number>();
        for (const t of txs) {
          const k = (t.merchant || "Unknown").toString();
          byMerchant.set(k, (byMerchant.get(k) || 0) + Number(t.amount));
        }
        const top = Array.from(byMerchant.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);

        const explain = await llmComplete({
          model: modelText,
          input: [
            { role: "system", content: [{ type: "input_text", text: ANSWER_SYSTEM }] },
            { role: "user", content: [{ type: "input_text", text:
              `User question: ${message}
Context:
- last_30_days_spend since ${cutoffISO}: ${last30Spend.toFixed(2)}
- top merchants: ${top.map(([m,amt])=>`${m}=$${amt.toFixed(2)}`).join(", ")}

Answer as a coach. If the user asks "what should I cut first", prioritize the top merchants and suggest 2 realistic changes.
If they ask "why overspending", point to top drivers + recurring-like patterns (mention subscriptions if you see Netflix/Spotify/etc).
Keep it short and concrete.`
            }] }
          ]
        });

        const reply: string =
          explain?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
          `In the last 30 days you spent $${last30Spend.toFixed(2)}. Top merchants: ${top.map(t=>t[0]).join(", ")}.`;

        return NextResponse.json({ reply });
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 400 });
      }
    }
