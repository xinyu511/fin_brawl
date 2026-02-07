"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getExpenses,
  getMe,
  getToken,
  type BackendTransaction,
} from "@/lib/backendClient";
import type { Transaction } from "@/lib/types";
import styles from "./page.module.css";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const STATIC_USER_ID = "static-user";
const STATIC_TXS: Transaction[] = [
  {
    id: "t1",
    user_id: STATIC_USER_ID,
    date: "2026-02-03",
    merchant: "Trader Joe's",
    amount: 64.23,
    category: "Groceries",
    source: "receipt",
    receipt_url: null,
    created_at: "2026-02-03T12:30:00Z",
  },
  {
    id: "t2",
    user_id: STATIC_USER_ID,
    date: "2026-02-01",
    merchant: "Uber",
    amount: 28.5,
    category: "Transport",
    source: "chat",
    receipt_url: null,
    created_at: "2026-02-01T18:20:00Z",
  },
  {
    id: "t3",
    user_id: STATIC_USER_ID,
    date: "2026-01-29",
    merchant: "Netflix",
    amount: 19.99,
    category: "Subscriptions",
    source: "chat",
    receipt_url: null,
    created_at: "2026-01-29T08:00:00Z",
  },
];

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
    if (STATIC_MODE) {
      setTxs(STATIC_TXS);
      return;
    }
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
    if (STATIC_MODE) {
      setStatus("Static mode: receipt upload disabled.");
      return;
    }
    if (!userId) {
      setStatus("Please login first.");
      return;
    }
    setStatus("Uploading receipt...");
    try {
      const { supabase } = await import("@/lib/supabaseClient");
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
    if (STATIC_MODE) {
      setStatus("");
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Static mode: chat disabled. Enable backend to use AI.",
        },
      ]);
      return;
    }
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
    <div className={`row ${styles.layout} page-body`}>
      <aside className={`card ${styles.sidebar}`}>
        <div className={styles.sidebarTitle}>Budget Agent</div>
        <div className={`stack ${styles.sidebarNav}`}>
          <a className={`${styles.tab} ${styles.tabActive}`} href="/dashboard">
            Overview
          </a>
          <a className={`${styles.tab}`} href="#transactions">
            Transactions
          </a>
          <a className={`${styles.tab}`} href="#chat">
            Chat
          </a>
          <a className={`${styles.tab}`} href="#receipts">
            Receipts
          </a>
          <a className={`${styles.tab}`} href="/login">
            Account
          </a>
        </div>
        <div className={`muted ${styles.sidebarMeta}`}>
          User: {userId ?? "Not logged in"}
        </div>
        {status && <div className={`muted ${styles.sidebarStatus}`}>{status}</div>}
      </aside>

      <div className={`stack ${styles.content}`}>
        <div className="card" id="overview">
          <h3 style={{ marginTop: 0 }}>Overview</h3>
          <div className={`row ${styles.statRow}`}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Last 30d spend</div>
              <div className={styles.statValue}>${last30Spend.toFixed(2)}</div>
            </div>
            <div className={styles.statCard}>
              <label className={styles.statLabel}>Monthly income</label>
              <input
                type="number"
                className={styles.statInput}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
              />
            </div>
            <div className={styles.statCard}>
              <label className={styles.statLabel}>Fixed costs (rent, utilities)</label>
              <input
                type="number"
                className={styles.statInput}
                value={fixedCosts}
                onChange={(e) => setFixedCosts(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="card" id="receipts">
          <h4 style={{ marginTop: 0 }}>Receipts</h4>
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

        <div className={`row ${styles.mainRow}`}>
          <div className={`card ${styles.chatCard}`} id="chat">
            <h4 style={{ marginTop: 0 }}>Chat</h4>
            <div className={styles.chatLog}>
              {chat.map((m, i) => (
                <div key={i} className={styles.chatItem}>
                  <div className="pill">{m.role}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
            </div>
            <div className={`row ${styles.chatInputRow}`}>
              <input
                className={styles.chatInput}
                placeholder='e.g., "Spent $45 on Uber yesterday" or "Can I afford a $2000 trip?"'
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>

          <div className={`card ${styles.transactionsCard}`} id="transactions">
            <h4 style={{ marginTop: 0 }}>Transactions</h4>
            {!userId ? (
              <div className="muted">Login to see your transactions.</div>
            ) : (
              <table className={styles.table}>
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
      </div>
    </div>
  );
}
