import { NextResponse } from "next/server";
import { z } from "zod";
import { llmComplete } from "@/lib/llm";

const Body = z.object({
  user_id: z.string().nullable(),
  token: z.string().optional(),
  message: z.string().min(1),
  finance: z
    .object({
      monthlyIncome: z.number().nonnegative(),
      fixedCosts: z.number().nonnegative(),
    })
    .optional(),
});

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

async function backendFetch<T = unknown>(
  path: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || res.statusText);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0")
    return undefined as T;
  return res.json() as Promise<T>;
}

// 1) Intent router prompt
const INTENT_SYSTEM = `You are an intent router for a budgeting app.
Return ONLY JSON: {"intent":"create_transaction"|"affordability"|"summary"|"city"|"income_info","confidence":0-1,"fields":{...}}.
- create_transaction: user states they spent money.
- affordability: user asks if they can afford a one-time purchase/trip.
- summary: user asks why overspending, what to cut, monthly summary.
- city: user asks which city to live in / cost of living.
- income_info: user asks about their income on file / monthly income / salary on record.`;

// 2) For create_transaction, extract minimal fields from text
const CREATE_SYSTEM = `Extract a transaction from the user's message.
Return ONLY JSON: {"merchant":string,"date":"YYYY-MM-DD","amount":number,"category":string|null}. 
If date not explicit, use today's date. Merchant can be a guess ("Uber", "Coffee").`;

// 3) Response style (explanation)
const ANSWER_SYSTEM = `You are a helpful financial coach. Be supportive, not judgmental.
Explain clearly in 4-8 short sentences. Provide 2 actionable suggestions when relevant.`;

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type BackendTx = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string | null;
};

type BackendIncome = {
  amount: number;
  source?: string;
};

async function sumLast30DaysAndTxs(token: string | null) {
  const txs = (await backendFetch<BackendTx[]>(
    "/expenses?limit=500",
    token
  )) as BackendTx[];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const last30 = txs.filter((t) => t.date >= cutoffISO);
  const total = last30.reduce((acc, t) => acc + Number(t.amount), 0);
  return { total, txs: last30, cutoffISO };
}

async function resolveMonthlyIncome(
  token: string | null,
  providedIncome: number | null | undefined
): Promise<number> {
  if (typeof providedIncome === "number" && providedIncome > 0) {
    return providedIncome;
  }
  if (!token) return 0;
  try {
    const incomes = (await backendFetch<BackendIncome[]>(
      "/incomes?limit=200",
      token
    )) as BackendIncome[];
    return incomes.reduce((acc, inc) => acc + Number(inc.amount || 0), 0);
  } catch {
    return 0;
  }
}

async function fetchIncomes(token: string | null): Promise<BackendIncome[]> {
  if (!token) return [];
  try {
    return (await backendFetch<BackendIncome[]>(
      "/incomes?limit=200",
      token
    )) as BackendIncome[];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const message = body.message;
    const token = body.token ?? null;
    const modelText = process.env.DEDALUS_API_KEY
      ? (process.env.DEDALUS_MODEL_TEXT || "openai/gpt-4o-mini")
      : (process.env.OPENAI_MODEL_TEXT || "gpt-4.1-mini");

    const guestMode = !token;
    if (guestMode) {
      const explain = await llmComplete({
        model: modelText,
        input: [
          { role: "system", content: [{ type: "input_text", text: ANSWER_SYSTEM }] },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${message}

Note: You do not have access to the user's transactions. Give general guidance and suggest logging in for personalized insights.`,
              },
            ],
          },
        ],
      });

      const reply: string =
        explain?.output?.[0]?.content?.find(
          (c: { type: string }) => c.type === "output_text"
        )?.text ?? "Please log in for personalized insights.";

      return NextResponse.json({ reply });
    }

    // Intent routing
    const intentResp = await llmComplete({
      model: modelText,
      input: [
        { role: "system", content: [{ type: "input_text", text: INTENT_SYSTEM }] },
        { role: "user", content: [{ type: "input_text", text: message }] },
      ],
    });

    const intentText: string =
      intentResp?.output?.[0]?.content?.find((c: { type: string }) => c.type === "output_text")
        ?.text ?? "";

    let routed: { intent: string };
    try {
      routed = JSON.parse(intentText);
    } catch {
      const m = intentText.match(/\{[\s\S]*\}/);
      routed = m ? JSON.parse(m[0]) : { intent: "summary" };
    }

    const intent = routed.intent as string;

    // --- income_info ---
    if (intent === "income_info") {
      const incomes = await fetchIncomes(token);
      if (!incomes.length) {
        return NextResponse.json({
          reply:
            "I don’t see any income records yet. Add them in Account → Income, then ask again.",
        });
      }
      const total = incomes.reduce((acc, inc) => acc + Number(inc.amount || 0), 0);
      const lines = incomes
        .map((inc) => {
          const amt = Number(inc.amount || 0).toFixed(2);
          const src = inc.source?.trim() || "Income";
          return `- ${src}: $${amt}`;
        })
        .join("\n");
      return NextResponse.json({
        reply: `Here’s your income on file:\n${lines}\n\nTotal monthly income: $${total.toFixed(
          2
        )}.`,
      });
    }

    // --- create_transaction ---
    if (intent === "create_transaction") {
      const createResp = await llmComplete({
        model: modelText,
        input: [
          { role: "system", content: [{ type: "input_text", text: CREATE_SYSTEM }] },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Today is ${todayISO()}. User message: ${message}`,
              },
            ],
          },
        ],
      });

      const txText: string =
        createResp?.output?.[0]?.content?.find(
          (c: { type: string }) => c.type === "output_text"
        )?.text ?? "";

      let tx: { merchant: string; date: string; amount: number; category?: string | null };
      try {
        tx = JSON.parse(txText);
      } catch {
        const m = txText.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Could not parse transaction JSON");
        tx = JSON.parse(m[0]);
      }

      const Tx = z.object({
        merchant: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.number(),
        category: z.string().nullable().optional(),
      });
      const parsed = Tx.parse(tx);

      await backendFetch(
        "/expenses",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            amount_cents: Math.round(parsed.amount * 100),
            category: parsed.category ?? "Other",
            occurred_at: parsed.date,
            note: parsed.merchant,
            merchant: parsed.merchant,
            source: "chat",
          }),
        }
      );

      return NextResponse.json({
        created_transaction: true,
        reply: `Logged: $${parsed.amount.toFixed(2)} at ${parsed.merchant} on ${parsed.date}.`,
      });
    }

    // --- affordability ---
    if (intent === "affordability") {
      const amountMatch = message
        .replace(/,/g, "")
        .match(/\$\s*(\d+(?:\.\d+)?)/);
      const target = amountMatch ? Number(amountMatch[1]) : 0;

      const { total: last30Spend, cutoffISO } =
        await sumLast30DaysAndTxs(token);
      const income = await resolveMonthlyIncome(token, body.finance?.monthlyIncome ?? null);
      const fixed =
        typeof body.finance?.fixedCosts === "number"
          ? body.finance?.fixedCosts
          : 0;
      const missing: string[] = [];
      if (!income || income <= 0) {
        missing.push(
          "monthly income (add it in Account → Income so I can use your real data)"
        );
      }
      if (!fixed || fixed <= 0) {
        missing.push(
          "monthly fixed costs (enter it in Account → Fixed costs)"
        );
      }
      if (missing.length > 0) {
        return NextResponse.json({
          reply: `I can answer that, but I’m missing: ${missing.join(
            "; "
          )}. Once you add those, ask again and I’ll run the affordability check.`,
        });
      }
      const estMonthly = last30Spend;
      const freeCash = income - fixed - estMonthly;
      const can = target > 0 ? freeCash >= target : freeCash >= 0;

      const explain = await llmComplete({
        model: modelText,
        input: [
          { role: "system", content: [{ type: "input_text", text: ANSWER_SYSTEM }] },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `User asked: ${message}
Numbers:
- last_30_days_spend (since ${cutoffISO}): ${last30Spend.toFixed(2)}
- monthly_income: ${income.toFixed(2)}
- fixed_costs: ${fixed.toFixed(2)}
- estimated_monthly_variable_spend: ${estMonthly.toFixed(2)}
- free_cash = income - fixed - estimated = ${freeCash.toFixed(2)}
Decision: ${can ? "YES" : "NO"} (target=${target.toFixed(2)})

Explain the decision and give 2 practical options.`,
              },
            ],
          },
        ],
      });

      const reply: string =
        explain?.output?.[0]?.content?.find(
          (c: { type: string }) => c.type === "output_text"
        )?.text ?? `Decision: ${can ? "Yes" : "No"}. Free cash: $${freeCash.toFixed(2)}.`;

      return NextResponse.json({ reply });
    }

    // --- city ---
    if (intent === "city") {
      const reply = `I can help with city choice, but I need a bit more info:
1) Your monthly income range?
2) Must-have city (or region/time zone)?
3) Biggest costs: rent vs food vs transit?
If you want a data-backed answer, plug in a cost-of-living dataset (TODO in code) and I'll compare rent + transit + typical expenses.`;
      return NextResponse.json({ reply });
    }

    // --- summary (default) ---
    const { total: last30Spend, txs, cutoffISO } =
      await sumLast30DaysAndTxs(token);
    if (txs.length === 0) {
      return NextResponse.json({
        reply:
          "I don’t have any transactions recorded yet. Add expenses in the Transactions page or upload a receipt, then ask again for a personalized summary.",
      });
    }

    const byMerchant = new Map<string, number>();
    for (const t of txs) {
      const k = (t.merchant || "Unknown").toString();
      byMerchant.set(k, (byMerchant.get(k) || 0) + Number(t.amount));
    }
    const top = Array.from(byMerchant.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const explain = await llmComplete({
      model: modelText,
      input: [
        { role: "system", content: [{ type: "input_text", text: ANSWER_SYSTEM }] },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `User question: ${message}
Context:
- last_30_days_spend since ${cutoffISO}: ${last30Spend.toFixed(2)}
- top merchants: ${top.map(([m, amt]) => `${m}=$${amt.toFixed(2)}`).join(", ")}

Answer as a coach. If the user asks "what should I cut first", prioritize the top merchants and suggest 2 realistic changes.
If they ask "why overspending", point to top drivers + recurring-like patterns (mention subscriptions if you see Netflix/Spotify/etc).
Keep it short and concrete.`,
            },
          ],
        },
      ],
    });

    const reply: string =
      explain?.output?.[0]?.content?.find(
        (c: { type: string }) => c.type === "output_text"
      )?.text ??
      `In the last 30 days you spent $${last30Spend.toFixed(2)}. Top merchants: ${top.map((t) => t[0]).join(", ")}.`;

    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 400 }
    );
  }
}
