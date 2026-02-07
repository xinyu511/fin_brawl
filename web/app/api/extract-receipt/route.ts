import { NextResponse } from "next/server";
import { z } from "zod";
import { llmComplete } from "@/lib/llm";

const Body = z.object({
  user_id: z.string(),
  token: z.string().optional(),
  receipt_url: z.string().url(),
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

const SYSTEM = `You extract receipt totals. Output ONLY JSON with keys: merchant, date (YYYY-MM-DD), amount (number).`;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { user_id, token, receipt_url } = Body.parse(json);

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
            { type: "input_image", image_url: receipt_url },
          ],
        },
      ],
    });

    const textOut: string =
      resp?.output?.[0]?.content?.find(
        (c: { type: string }) => c.type === "output_text"
      )?.text ?? "";

    let extracted: { merchant: string; date: string; amount: number };
    try {
      extracted = JSON.parse(textOut);
    } catch {
      const m = textOut.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Could not parse JSON from model output");
      extracted = JSON.parse(m[0]);
    }

    const Tx = z.object({
      merchant: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number(),
    });
    const tx = Tx.parse(extracted);

    await backendFetch(
      "/expenses",
      token,
      {
        method: "POST",
        body: JSON.stringify({
          amount_cents: Math.round(tx.amount * 100),
          category: "Receipt",
          occurred_at: tx.date,
          note: tx.merchant,
          source: "receipt",
        }),
      }
    );

    return NextResponse.json({ ok: true, extracted: tx });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 400 }
    );
  }
}
