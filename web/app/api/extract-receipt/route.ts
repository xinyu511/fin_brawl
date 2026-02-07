import { NextResponse } from "next/server";
import { z } from "zod";
import { llmComplete } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const Body = z.object({
  user_id: z.string().uuid(),
  receipt_url: z.string().url(),
});

// Receipt extraction prompt:
const SYSTEM = `You extract receipt totals. Output ONLY JSON with keys: merchant, date (YYYY-MM-DD), amount (number).`;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { user_id, receipt_url } = Body.parse(json);

    const model = process.env.DEDALUS_API_KEY
      ? (process.env.DEDALUS_MODEL_VISION || "openai/gpt-4o-mini")
      : (process.env.OPENAI_MODEL_VISION || "gpt-4.1-mini");

    const resp = await llmComplete({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: SYSTEM }]
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "From this receipt image, output ONLY JSON with merchant, date (YYYY-MM-DD), and total amount." },
            { type: "input_image", image_url: receipt_url }
          ]
        }
      ]
    });

    const textOut: string =
      resp?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ?? "";

    let extracted: any;
    try {
      extracted = JSON.parse(textOut);
    } catch {
      // Sometimes the model returns extra whitespace; try to recover.
      const m = textOut.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Could not parse JSON from model output");
      extracted = JSON.parse(m[0]);
    }

    const Tx = z.object({
      merchant: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amount: z.number()
    });
    const tx = Tx.parse(extracted);

    const { error } = await supabaseAdmin.from("transactions").insert({
      user_id,
      date: tx.date,
      merchant: tx.merchant,
      amount: tx.amount,
      category: null,
      source: "receipt",
      receipt_url
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, extracted: tx });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 400 });
  }
}
