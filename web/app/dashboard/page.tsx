"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getExpenses,
  getMe,
  getProfile,
  getIncomes,
  getToken,
  type BackendTransaction,
  type BackendIncome,
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

  const [netWorth, setNetWorth] = useState<number>(0);
  const [incomeTotal, setIncomeTotal] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  async function refreshAccountSnapshot() {
    if (!userId) return;
    if (STATIC_MODE) {
      setNetWorth(0);
      setIncomeTotal(0);
      return;
    }
    try {
      const [profileResp, incomes] = await Promise.all([
        getProfile(),
        getIncomes(),
      ]);
      const profile = profileResp.profile;
      const nw = profile.net_worth_cents != null ? profile.net_worth_cents / 100 : 0;
      const incomeSum = incomes.reduce(
        (acc: number, inc: BackendIncome) => acc + Number(inc.amount || 0),
        0
      );
      setNetWorth(nw);
      setIncomeTotal(incomeSum);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load account data.");
    }
  }

  useEffect(() => {
    if (!userId) return;
    refreshTransactions();
    refreshAccountSnapshot();
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleStorage(e: StorageEvent) {
      if (e.key === "fin_brawl_account_refresh") {
        refreshAccountSnapshot();
      }
    }
    function handleFocus() {
      refreshAccountSnapshot();
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [userId]);

  const last30Spend = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return txs
      .filter((t) => new Date(t.date) >= cutoff)
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [txs]);

  const totalSpend = useMemo(() => {
    return txs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [txs]);

  const currentBalance = useMemo(() => {
    return netWorth + incomeTotal - totalSpend;
  }, [incomeTotal, netWorth, totalSpend]);

  const last7Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return d;
    });
  }, []);

  const categoryTrend = useMemo(() => {
    if (!selectedCategory) return [];
    const map = new Map<string, number>();
    for (const t of txs) {
      if ((t.category || "Other") !== selectedCategory) continue;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(t.amount || 0));
    }
    return last7Days.map((d) => {
      const key = d.toISOString().slice(0, 10);
      return { date: key, amount: map.get(key) || 0 };
    });
  }, [last7Days, selectedCategory, txs]);

  const trendMax = useMemo(() => {
    return Math.max(1, ...categoryTrend.map((d) => d.amount));
  }, [categoryTrend]);

  const trendPoints = useMemo(() => {
    if (!categoryTrend.length) return "";
    return categoryTrend
      .map((d, i) => {
        const x = (i / Math.max(1, categoryTrend.length - 1)) * 100;
        const y = 100 - (d.amount / trendMax) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [categoryTrend, trendMax]);

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
              <div className={`${styles.statCard} ${styles.statSplit}`}>
                <div className={styles.statLabel}>Last 30 days spend</div>
                <div className={styles.statValue}>${last30Spend.toFixed(2)}</div>
              </div>
              <div className={`${styles.statCard} ${styles.statSplit}`}>
                <div className={styles.statLabel}>Current total balance</div>
                <div className={styles.statValue}>${currentBalance.toFixed(2)}</div>
              </div>
            </div>
            <div className={`brand-font ${styles.categoryHeading}`}>
              Main Spending Categories
            </div>
            <div className={styles.overviewArt}>
              <div className={styles.overviewArtInner}>
                {topCategories.map((label, i) => (
                  <div
                    key={label}
                    className={`${styles.artBox} ${artClasses[i]}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCategory(label)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCategory(label);
                      }
                    }}
                  >
                    <span className={`brand-font ${styles.artLabel}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedCategory && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedCategory(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={`brand-font ${styles.modalTitle}`}>
                {selectedCategory} • Last 7 Days
              </div>
              <button
                className={styles.modalClose}
                onClick={() => setSelectedCategory(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={styles.trendChart}>
              <svg viewBox="0 0 100 100" className={styles.trendSvg} preserveAspectRatio="none">
                <polyline className={styles.trendLine} points={trendPoints} />
              </svg>
              <div className={styles.trendAxis}>
                {categoryTrend.map((d) => (
                  <div key={d.date} className={styles.trendTick}>
                    <div className={styles.trendDate}>{d.date.slice(5)}</div>
                    <div className={styles.trendAmount}>${d.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
