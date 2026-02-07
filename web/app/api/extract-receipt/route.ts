import { NextResponse } from "next/server";
import { z } from "zod";
import { llmComplete } from "@/lib/llm";

const Body = z
  .object({
    user_id: z.string(),
    token: z.string().optional(),
    receipt_url: z.string().url().optional(),
    receipt_data_url: z.string().min(1).optional(),
  })
  .refine((b) => b.receipt_url || b.receipt_data_url, {
    message: "receipt_url or receipt_data_url is required",
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

const SYSTEM = `You extract transactions from receipt images.
Output ONLY JSON: an array of objects. Each object must have:
- merchant (string)
- date (YYYY-MM-DD)
- amount (number, total charged for that transaction)
Optional fields:
- category (string, choose the best fit from: Groceries, Dining, Transport, Housing, Utilities, Health, Entertainment, Subscriptions, Shopping, Other)
- note (string)
If the receipt clearly represents a single purchase, return a single-item array.`;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { user_id, token, receipt_url, receipt_data_url } = Body.parse(json);

    if (!token) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    const model = process.env.DEDALUS_API_KEY
      ? (process.env.DEDALUS_MODEL_VISION || "openai/gpt-4o-mini")
      : (process.env.OPENAI_MODEL_VISION || "gpt-4.1-mini");

    const resp = await llmComplete({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "From this receipt image, output ONLY JSON with merchant, date (YYYY-MM-DD), and total amount.",
            },
            { type: "input_image", image_url: receipt_url || receipt_data_url! },
          ],
        },
      ],
    });

    const textOut: string =
      resp?.output?.[0]?.content?.find(
        (c: { type: string }) => c.type === "output_text"
      )?.text ?? "";

    let extracted: unknown;
    try {
      extracted = JSON.parse(textOut);
    } catch {
      const arr = textOut.match(/\[[\s\S]*\]/);
      const obj = textOut.match(/\{[\s\S]*\}/);
      const candidate = arr?.[0] || obj?.[0];
      if (!candidate) throw new Error("Could not parse JSON from model output");
      extracted = JSON.parse(candidate);
    }

    const Tx = z.object({
      merchant: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number(),
      category: z.string().min(1).optional(),
      note: z.string().min(1).optional(),
    });

    const txsRaw = Array.isArray(extracted) ? extracted : [extracted];
    const today = new Date().toISOString().slice(0, 10);
    const normalized = txsRaw.map((t: any) => {
      const rawDate = typeof t?.date === "string" ? t.date : "";
      const isoMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
      const date = isoMatch ? isoMatch[0] : today;
      return { ...t, date };
    });
    const txs = z.array(Tx).min(1).parse(normalized);

    const createdIds: number[] = [];
    for (const tx of txs) {
      const created = await backendFetch<{ id: number }>(
        "/expenses",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            amount_cents: Math.round(tx.amount * 100),
            category: tx.category || "Receipt",
            occurred_at: tx.date,
            note: tx.note || tx.merchant,
            merchant: tx.merchant,
            source: "receipt",
            receipt_url: receipt_url || null,
          }),
        }
      );
      createdIds.push(created.id);
    }

    return NextResponse.json({ ok: true, extracted: txs, created_ids: createdIds });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 400 }
    );
  }
}
