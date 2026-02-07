"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addExpense,
  deleteExpense,
  getExpenses,
  getMe,
  getToken,
  type BackendTransaction,
} from "@/lib/backendClient";
import type { Transaction } from "@/lib/types";
import Sidebar from "../dashboard/Sidebar";
import styles from "../dashboard/page.module.css";

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

type ManualEntry = {
  date: string;
  merchant: string;
  amount: string;
  category: string;
};

const emptyManual: ManualEntry = {
  date: "",
  merchant: "",
  amount: "",
  category: "",
};


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

export default function TransactionsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<string>("");
  const [manual, setManual] = useState<ManualEntry>(emptyManual);
  useEffect(() => {
    if (STATIC_MODE) {
      setUserId(STATIC_USER_ID);
      setUsername("static-user");
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
        setUsername(me.username);
      } catch {
        setUserId(null);
        setUsername(null);
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

  async function addManualTransaction() {
    if (STATIC_MODE) {
      const now = new Date().toISOString();
      setTxs((prev) => [
        {
          id: `m-${Date.now()}`,
          user_id: STATIC_USER_ID,
          date: manual.date || now.slice(0, 10),
          merchant: manual.merchant || "Manual",
          amount: Number(manual.amount || 0),
          category: manual.category || "Other",
          source: "manual",
          receipt_url: null,
          created_at: now,
        },
        ...prev,
      ]);
      setManual(emptyManual);
      return;
    }
    if (!userId) {
      setStatus("Please login first.");
      return;
    }
    const amountNum = Number(manual.amount);
    if (!manual.date || !manual.merchant || !manual.category || Number.isNaN(amountNum)) {
      setStatus("Please fill all fields with valid values.");
      return;
    }
    setStatus("Adding transaction...");
    try {
      await addExpense({
        amount_cents: Math.round(amountNum * 100),
        category: manual.category,
        occurred_at: manual.date,
        merchant: manual.merchant,
        note: manual.merchant,
        source: manual.source,
      });
      setManual(emptyManual);
      setStatus("");
      await refreshTransactions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to add transaction.");
    }
  }

  async function removeTransaction(id: string) {
    if (STATIC_MODE) {
      setTxs((prev) => prev.filter((t) => t.id !== id));
      return;
    }
    try {
      await deleteExpense(id);
      await refreshTransactions();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to delete transaction.");
    }
  }

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

  return (
    <div className={`row ${styles.layout} page-body`}>
      <Sidebar active="transactions" username={username} status={status} />

      <div className={`stack ${styles.content}`}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Transactions</h3>
          <div className={`row ${styles.statRow}`}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Last 30d spend</div>
              <div className={styles.statValue}>${last30Spend.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="card">
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

        <div className="card">
          <h4 style={{ marginTop: 0 }}>Manual Entry</h4>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="stack" style={{ minWidth: 150 }}>
              <label className="muted">Date</label>
              <input
                type="date"
                value={manual.date}
                onChange={(e) => setManual({ ...manual, date: e.target.value })}
              />
            </div>
            <div className="stack" style={{ minWidth: 160 }}>
              <label className="muted">Merchant</label>
              <input
                placeholder="e.g., Uber"
                value={manual.merchant}
                onChange={(e) => setManual({ ...manual, merchant: e.target.value })}
              />
            </div>
            <div className="stack" style={{ minWidth: 120 }}>
              <label className="muted">Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 12.50"
                value={manual.amount}
                onChange={(e) => setManual({ ...manual, amount: e.target.value })}
              />
            </div>
            <div className="stack" style={{ minWidth: 160 }}>
              <label className="muted">Category</label>
              <select
                style={{ paddingTop: 10, paddingBottom: 10 }}
                value={manual.category}
                onChange={(e) => setManual({ ...manual, category: e.target.value })}
              >
                <option value="">Select...</option>
                <option value="Groceries">Groceries</option>
                <option value="Dining">Dining</option>
                <option value="Transport">Transport</option>
                <option value="Housing">Housing</option>
                <option value="Utilities">Utilities</option>
                <option value="Health">Health</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Shopping">Shopping</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button onClick={addManualTransaction}>Upload</button>
          </div>
        </div>

        <div className={`card ${styles.transactionsCard}`}>
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
                  <th></th>
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
                      <button onClick={() => removeTransaction(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
