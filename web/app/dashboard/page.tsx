"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getExpenses,
  getMe,
  getToken,
  type BackendTransaction,
} from "@/lib/backendClient";
import type { Transaction } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

type ChatMsg = { role: "user" | "assistant"; content: string };

function toTransaction(t: BackendTransaction): Transaction {
  return {
    id: t.id,
    user_id: t.user_id,
    date: t.date,
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    source: t.source,
    receipt_url: t.receipt_url,
    created_at: t.created_at,
  };
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi! Upload a receipt or tell me an expense. You can also ask: Can I afford a $2000 trip?",
    },
  ]);

  const [monthlyIncome, setMonthlyIncome] = useState<number>(4000);
  const [fixedCosts, setFixedCosts] = useState<number>(1500);

  useEffect(() => {
    if (STATIC_MODE) {
      setUserId(STATIC_USER_ID);
      setTxs(STATIC_TXS);
      setStatus("Static mode enabled — using mock data.");
      return;
    }
    (async () => {
      const token = getToken();
      if (!token) {
        setStatus("Not logged in. Go to /login to sign in.");
        return;
      }
      try {
        const me = await getMe();
        setUserId(String(me.user_id));
      } catch {
        setUserId(null);
        setStatus("Session expired or invalid. Go to /login to sign in.");
      }
    })();
  }, []);

  async function refreshTransactions() {
    if (!userId) return;
    try {
      const data = await getExpenses();
      setTxs(data.map(toTransaction));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load transactions.");
    }
  }

  useEffect(() => {
    if (!userId) return;
    refreshTransactions();
  }, [userId]);

  const last30Spend = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return txs
      .filter((t) => new Date(t.date) >= cutoff)
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [txs]);

  async function uploadReceipt(file: File) {
    if (!userId) {
      setStatus("Please login first.");
      return;
    }
    setStatus("Uploading receipt...");
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setStatus(upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
      const receiptUrl = pub.publicUrl;

      setStatus("Extracting transaction with OpenAI vision...");
      const res = await fetch("/api/extract-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          receipt_url: receiptUrl,
          token: getToken(),
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        setStatus(out.error || "Extraction failed");
        return;
      }
      setStatus("Saved transaction from receipt!");
      await refreshTransactions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Receipt upload failed.");
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    setChat((prev) => [...prev, { role: "user", content: msg }]);
    setStatus("Thinking...");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        message: msg,
        finance: { monthlyIncome, fixedCosts },
        token: getToken(),
      }),
    });
    const out = await res.json();
    if (!res.ok) {
      setStatus(out.error || "Chat failed");
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — something went wrong." },
      ]);
      return;
    }
    setStatus("");
    if (out.created_transaction) await refreshTransactions();
    setChat((prev) => [...prev, { role: "assistant", content: out.reply }]);
  }

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dashboard</h3>
        <div className="muted">
          User: {userId ?? "Not logged in"} • Last 30d spend:{" "}
          <b>${last30Spend.toFixed(2)}</b>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="stack" style={{ minWidth: 260 }}>
            <label className="muted">Monthly income</label>
            <input
              type="number"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(Number(e.target.value))}
            />
          </div>
          <div className="stack" style={{ minWidth: 260 }}>
            <label className="muted">Fixed costs (rent, utilities)</label>
            <input
              type="number"
              value={fixedCosts}
              onChange={(e) => setFixedCosts(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="muted">Upload receipt photo (jpg/png)</label>
          <br />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadReceipt(f);
            }}
          />
        </div>

        {status && (
          <div className="muted" style={{ marginTop: 10 }}>
            {status}
          </div>
        )}
      </div>

      <div className="row">
        <div className="card" style={{ flex: 2, minWidth: 360 }}>
          <h4 style={{ marginTop: 0 }}>Chat</h4>
          <div
            style={{
              height: 260,
              overflow: "auto",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 10,
            }}
          >
            {chat.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div className="pill">{m.role}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              style={{ flex: 1 }}
              placeholder='e.g., "Spent $45 on Uber yesterday" or "Can I afford a $2000 trip?"'
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
            />
            <button onClick={sendChat}>Send</button>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Tip: Ask “What should I cut first?” after you have some transactions.
          </div>
        </div>

        <div className="card" style={{ flex: 3, minWidth: 420 }}>
          <h4 style={{ marginTop: 0 }}>Transactions</h4>
          {!userId ? (
            <div className="muted">Login to see your transactions.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.merchant}</td>
                    <td>${Number(t.amount).toFixed(2)}</td>
                    <td>{t.category ?? "-"}</td>
                    <td>
                      <span className="pill">{t.source}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Next steps (optional)</h4>
        <ul className="muted" style={{ marginBottom: 0 }}>
          <li>
            Add a pie chart endpoint (server) + chart component (client) for
            category breakdown.
          </li>
          <li>
            Implement recurring charge detection in{" "}
            <code>app/api/chat/route.ts</code> using merchant + monthly pattern.
          </li>
          <li>
            Implement screenshot OCR or use OpenAI vision on bank statement
            screenshots.
          </li>
          <li>
            Add city cost-of-living data and answer “Which city should I live
            in…” more concretely.
          </li>
        </ul>
      </div>
    </div>
  );
}
