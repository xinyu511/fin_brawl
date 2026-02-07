/**
 * Unified LLM layer: OpenAI Responses API or Dedalus Labs MCP (chat completions).
 * Set DEDALUS_API_KEY to use Dedalus; otherwise OpenAI is used.
 *
 * Both return the same shape: { output: [{ content: [{ type: "output_text", text }] }] }
 * so chat and extract-receipt routes can stay unchanged.
 */

// Same shape the app uses (OpenAI Responses-style input)
export type LLMInputMessage = {
  role: "system" | "user" | "assistant";
  content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string }
  >;
};

export type LLMPayload = {
  model: string;
  input: LLMInputMessage[];
};

export type LLMResponse = {
  output: Array<{
    content: Array<{ type: "output_text"; text: string }>;
  }>;
};

function isDedalus(): boolean {
  return !!process.env.DEDALUS_API_KEY;
}

/** Convert Responses-style input to OpenAI chat messages (for Dedalus). */
function toChatMessages(input: LLMInputMessage[]): Array<{ role: string; content: string | object[] }> {
  return input.map((msg) => {
    const parts = msg.content.map((c) => {
      if (c.type === "input_text") return { type: "text" as const, text: c.text };
      if (c.type === "input_image") return { type: "image_url" as const, image_url: { url: c.image_url } };
      return null;
    }).filter(Boolean) as object[];

    const content = parts.length === 1 && "text" in parts[0]
      ? (parts[0] as { text: string }).text
      : parts;

    return { role: msg.role, content };
  });
}

/** Call Dedalus Labs chat completions (OpenAI-compatible). */
async function dedalusComplete(payload: LLMPayload): Promise<LLMResponse> {
  const apiKey = process.env.DEDALUS_API_KEY;
  if (!apiKey) throw new Error("Missing DEDALUS_API_KEY");

  const messages = toChatMessages(payload.input);
  const body = {
    model: payload.model,
    messages,
    max_tokens: 2048,
  };

  const res = await fetch("https://api.dedaluslabs.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dedalus error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";

  return {
    output: [{ content: [{ type: "output_text", text }] }],
  };
}

/** Call OpenAI Responses API. */
async function openaiComplete(payload: LLMPayload): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const raw = await res.json();
  // Normalize to same shape (OpenAI Responses already has output[].content[].text)
  const text =
    raw?.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text ??
    raw?.output_text ??
    "";
  return {
    output: [{ content: [{ type: "output_text", text }] }],
  };
}

/**
 * Single entry point for LLM calls. Uses Dedalus if DEDALUS_API_KEY is set, else OpenAI.
 * Payload uses Responses-style input; response is normalized to { output: [{ content: [{ type: "output_text", text }] }] }.
 */
export async function llmComplete(payload: LLMPayload): Promise<LLMResponse> {
  if (isDedalus()) return dedalusComplete(payload);
  return openaiComplete(payload);
}
