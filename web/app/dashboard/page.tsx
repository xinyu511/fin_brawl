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
import Sidebar from "./Sidebar";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const STATIC_USER_ID = "static-user";
const DEFAULT_CATEGORIES = [
  "Groceries",
  "Housing",
  "Dining",
  "Shopping",
  "Transport",
] as const;
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
  const [username, setUsername] = useState<string | null>(null);
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

  const topCategories = useMemo(() => {
    if (!txs.length) return [...DEFAULT_CATEGORIES];
    const totals = new Map<string, number>();
    for (const t of txs) {
      const key = t.category?.trim() || "Other";
      totals.set(key, (totals.get(key) || 0) + Number(t.amount || 0));
    }
    const sorted = [...totals.entries()]
      .filter(([, v]) => Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const picks = sorted.slice(0, 5);
    if (picks.length >= 5) return picks;
    for (const fallback of DEFAULT_CATEGORIES) {
      if (!picks.includes(fallback)) picks.push(fallback);
      if (picks.length >= 5) break;
    }
    return picks;
  }, [txs]);

  const artClasses = [styles.artA, styles.artB, styles.artC, styles.artD, styles.artE];

  return (
    <div className={`row ${styles.layout} page-body`}>
      <Sidebar active="overview" username={username} status={status} />

      <div className={`stack ${styles.content}`}>
        <div className="card" id="overview">
          <div className={styles.overviewStage}>
            <div className={`row ${styles.statRow}`}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Last 30d spend</div>
                <div className={styles.statValue}>${last30Spend.toFixed(2)}</div>
              </div>
            </div>
            <div className={styles.overviewArt} aria-hidden="true">
              <div className={styles.overviewArtInner}>
                  {topCategories.map((label, i) => (
                  <div key={label} className={`${styles.artBox} ${artClasses[i]}`}>
                    <span className={`brand-font ${styles.artLabel}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
