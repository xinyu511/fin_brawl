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
import styles from "./page.module.css";

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
  date: new Date().toISOString().slice(0, 10),
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
  function toLocalISODate(year: number, monthIndex: number, day: number): string {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<string>("");
  const [manual, setManual] = useState<ManualEntry>(emptyManual);
  const [fixedCosts, setFixedCosts] = useState<number>(1500);
  const [showManual, setShowManual] = useState<boolean>(false);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<number>(7);
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [interval, setInterval] = useState<"day" | "month" | "quarter" | "year">("month");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const baseMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const selectedDate = useMemo(() => {
    return toLocalISODate(
      baseMonth.getFullYear(),
      baseMonth.getMonth(),
      selectedDay
    );
  }, [baseMonth, selectedDay]);
  const daysInMonth = useMemo(() => {
    return new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0).getDate();
  }, [baseMonth]);
  const firstDow = useMemo(() => {
    // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
    return (baseMonth.getDay() + 6) % 7;
  }, [baseMonth]);
  const calendarCells = useMemo(() => {
    const blanks = Array.from({ length: firstDow }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [firstDow, daysInMonth]);
  const intervalRange = useMemo(() => {
    const start = new Date(
      baseMonth.getFullYear(),
      baseMonth.getMonth(),
      selectedDay
    );
    start.setHours(0, 0, 0, 0);
    let end = new Date(start);
    if (interval === "day") {
      end.setDate(start.getDate() + 1);
    } else if (interval === "month") {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    } else if (interval === "quarter") {
      const q = Math.floor(start.getMonth() / 3);
      end = new Date(start.getFullYear(), q * 3 + 3, 1);
    } else {
      end = new Date(start.getFullYear() + 1, 0, 1);
    }
    return { start, end };
  }, [baseMonth, selectedDay, interval]);
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
      .filter((t) => new Date(`${t.date}T00:00:00`) >= cutoff)
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [txs]);

  const last30Change = useMemo(() => {
    const end = new Date();
    const start30 = new Date(end);
    start30.setDate(start30.getDate() - 30);
    const start60 = new Date(end);
    start60.setDate(start60.getDate() - 60);

    let prevSum = 0;
    let prevCount = 0;
    let currSum = 0;

    for (const t of txs) {
      const d = new Date(`${t.date}T00:00:00`);
      if (d >= start30 && d < end) {
        currSum += Number(t.amount);
      } else if (d >= start60 && d < start30) {
        prevSum += Number(t.amount);
        prevCount += 1;
      }
    }

    if (prevCount === 0 || prevSum === 0) {
      return null;
    }

    return ((currSum - prevSum) / prevSum) * 100;
  }, [txs]);

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (
        filterCategory !== "all" &&
        (t.category ?? "").toLowerCase() !== filterCategory.toLowerCase()
      ) {
        return false;
      }
      const d = new Date(`${t.date}T00:00:00`);
      if (d < intervalRange.start || d >= intervalRange.end) return false;
      return true;
    });
  }, [txs, filterCategory, intervalRange]);
  const filteredTotal = useMemo(() => {
    return filteredTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [filteredTxs]);
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTxs) {
      const key = (t.category ?? "Other").trim() || "Other";
      map.set(key, (map.get(key) ?? 0) + Number(t.amount || 0));
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTxs]);
  const palette = [
    "#2f7d6d",
    "#4f9a7a",
    "#6bbf8f",
    "#8fd4ad",
    "#bfe6d6",
    "#d8efe7",
    "#94c9b0",
    "#5aa98c",
  ];
  const donutStops = useMemo(() => {
    if (filteredTotal <= 0) return ["#e1e1e1 0 100%"];
    let acc = 0;
    return categoryTotals.map((c, i) => {
      const pct = (c.total / filteredTotal) * 100;
      const start = acc;
      const end = acc + pct;
      acc = end;
      return `${palette[i % palette.length]} ${start}% ${end}%`;
    });
  }, [categoryTotals, filteredTotal]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / pageSize));
  const pagedTxs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTxs.slice(start, start + pageSize);
  }, [filteredTxs, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function addManualTransaction() {
    const amountStr = manual.amount.trim().replace(/,/g, "");
    const amountNum = Number.parseFloat(amountStr);
    if (!amountStr || !Number.isFinite(amountNum) || amountNum <= 0) {
      setStatus("Enter a valid amount.");
      return;
    }
    const occurredAt = manual.date || new Date().toISOString().slice(0, 10);
    const merchant = manual.merchant.trim() || "Manual";
    const category = manual.category.trim() || "Other";

    if (STATIC_MODE) {
      const now = new Date().toISOString();
      setTxs((prev) => [
        {
          id: `m-${Date.now()}`,
          user_id: STATIC_USER_ID,
          date: occurredAt,
          merchant,
          amount: amountNum,
          category,
          source: "manual",
          receipt_url: null,
          created_at: now,
        },
        ...prev,
      ]);
      setManual((prev) => ({ ...prev, amount: "" }));
      setStatus("");
      return;
    }
    if (!userId) {
      setStatus("Please login first.");
      return;
    }
    setStatus("Adding transaction...");
    try {
      await addExpense({
        amount_cents: Math.round(amountNum * 100),
        category,
        occurred_at: occurredAt,
        merchant,
        note: merchant,
        source: "manual",
      });
      setManual((prev) => ({ ...prev, amount: "" }));
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
        <div className={styles.topGrid}>
          <div className={styles.leftCol}>
            <div className={styles.welcomeCard}>
              <div className={`${styles.welcomeTitle} greeting-font`}>
                Hello, {username ?? "friend"}
              </div>
              <div className={styles.welcomeSub}>
                Here’s a quick snapshot of your finances for this month.
              </div>
              <div className={styles.smallCards}>
                <div className={styles.miniCard}>
                  <div className={styles.miniTitle}>Last 30d spend</div>
                  <div className={styles.miniValue}>${last30Spend.toFixed(2)}</div>
                  <div className={styles.sparkline} />
                </div>
                <div className={styles.miniCard}>
                  <div className={styles.miniTitle}>30d spend change</div>
                  <div className={styles.miniValue}>
                    {last30Change == null ? "N/A" : `${last30Change > 0 ? "+" : ""}${last30Change.toFixed(1)}%`}
                  </div>
                  <div className={styles.sparklineAlt} />
                </div>
              </div>
            </div>

          <div className={`card ${styles.transactionsCard}`}>
            <div className={styles.tableHeader}>
              <h4 className={`greeting-font ${styles.transactionsTitle}`} style={{ margin: 0 }}>Recent Transactions</h4>
              <div className={styles.filterRow}>
              <div className={styles.filterField}>
                <select value={interval} onChange={(e) => setInterval(e.target.value as typeof interval)}>
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div className={styles.filterField}>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All</option>
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
            </div>
            </div>
            {!userId ? (
              <div className="muted">Login to see your transactions.</div>
            ) : (
                <div className={styles.tableScroll}>
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
                      {pagedTxs.map((t) => (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td>{t.merchant}</td>
                          <td>${Number(t.amount).toFixed(2)}</td>
                          <td>{t.category ?? "-"}</td>
                          <td>
                            <button onClick={() => removeTransaction(t.id)} aria-label="Delete">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {userId && (
                <div className={styles.tablePager}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ←
                  </button>
                  <div className={styles.pageInfo}>
                    Page {page} / {totalPages}
                  </div>
                  <button
                    className={styles.iconBtn}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.rightCol}>
            <div className={styles.calendarCard}>
              <div className={styles.calendarHeader}>
                <button
                  className={styles.iconBtn}
                  aria-label="Previous month"
                  onClick={() => setMonthOffset((m) => m - 1)}
                >
                  ←
                </button>
                <div className={styles.pill}>
                  {baseMonth.toLocaleString("en-US", { month: "short", year: "numeric" })}
                </div>
                <button
                  className={styles.iconBtn}
                  aria-label="Next month"
                  onClick={() => setMonthOffset((m) => m + 1)}
                >
                  →
                </button>
              </div>
              <div className={styles.calendarGrid}>
                {["MO","TU","WE","TH","FR","SA","SU"].map(d => (
                  <div key={d} className={styles.calendarDow}>{d}</div>
                ))}
                {calendarCells.map((d, idx) =>
                  d === null ? (
                    <div key={`blank-${idx}`} className={styles.calendarBlank} />
                  ) : (
                    <button
                      type="button"
                      key={d}
                      className={`${styles.calendarDay} ${d === selectedDay ? styles.calendarActive : ""}`}
                      onClick={() => {
                        setSelectedDay(d);
                        setManual((prev) => ({
                          ...prev,
                          date: toLocalISODate(
                            baseMonth.getFullYear(),
                            baseMonth.getMonth(),
                            d
                          ),
                        }));
                      }}
                    >
                      {d}
                    </button>
                  )
                )}
              </div>
              <div className={styles.calendarSelected}>Selected: {selectedDate}</div>
              <div className={styles.calendarActions}>
                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    setShowReceipt(false);
                    setShowManual((v) => !v);
                  }}
                >
                  {showManual ? "Close" : "Add event"}
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setShowManual(false);
                    setShowReceipt(true);
                  }}
                >
                  Add receipt
                </button>
              </div>
            </div>

            <div className={styles.pieCard}>
              <div className={styles.pieHeader}>
                <div className={`${styles.pieTitle} greeting-font`}>Budget</div>
                <div className={styles.pieBadge}>${filteredTotal.toFixed(2)}</div>
              </div>
              <div className={styles.pieBody}>
                <ul className={styles.pieLegend}>
                  {categoryTotals.length === 0 ? (
                    <li><span className={styles.dot} style={{ background: "#e1e1e1" }} /> No data</li>
                  ) : (
                    categoryTotals.map((c, i) => (
                      <li key={c.category}>
                        <span className={styles.dot} style={{ background: palette[i % palette.length] }} />
                        {c.category}
                      </li>
                    ))
                  )}
                </ul>
                <div className={styles.donutWrap}>
                  <div
                    className={styles.donut}
                    style={{ background: `conic-gradient(${donutStops.join(", ")})` }}
                  >
                    <div className={styles.donutCenter}>
                      <div className={styles.donutLabel}>Total for month</div>
                      <div className={styles.donutValue}>${filteredTotal.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className={styles.donutTag}>
                    {filterCategory === "all" ? "All categories" : filterCategory}
                  </div>
                </div>
              </div>
            </div>
          </div>

          
        </div>


        {showManual && (
          <div className={styles.modalOverlay} onClick={() => setShowManual(false)}>
            <div className={`${styles.modal} card`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h4 style={{ margin: 0 }}>Manual Entry</h4>
                <button className={styles.iconBtn} onClick={() => setShowManual(false)}>
                  ✕
                </button>
              </div>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="stack" style={{ minWidth: 150 }}>
                <label className="muted">Date</label>
                <input
                  type="date"
                  value={manual.date}
                  onChange={(e) => {
                    setManual({ ...manual, date: e.target.value });
                    if (status) setStatus("");
                  }}
                />
              </div>
              <div className="stack" style={{ minWidth: 160 }}>
                <label className="muted">Merchant</label>
                <input
                  placeholder="e.g., Uber"
                  value={manual.merchant}
                  onChange={(e) => {
                    setManual({ ...manual, merchant: e.target.value });
                    if (status) setStatus("");
                  }}
                />
              </div>
              <div className="stack" style={{ minWidth: 120 }}>
                <label className="muted">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 12.50"
                  value={manual.amount}
                  onChange={(e) => {
                    setManual({ ...manual, amount: e.target.value });
                    if (status) setStatus("");
                  }}
                />
              </div>
              <div className="stack" style={{ minWidth: 160 }}>
                <label className="muted">Category</label>
                <select
                  style={{ paddingTop: 10, paddingBottom: 10 }}
                  value={manual.category}
                  onChange={(e) => {
                    setManual({ ...manual, category: e.target.value });
                    if (status) setStatus("");
                  }}
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
            {status && (
              <div className="muted" style={{ marginTop: 8 }}>
                {status}
              </div>
            )}
            </div>
          </div>
        )}

        {showReceipt && (
          <div className={styles.modalOverlay} onClick={() => setShowReceipt(false)}>
            <div className={`${styles.modal} card`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h4 style={{ margin: 0 }}>Add Receipt</h4>
                <button className={styles.iconBtn} onClick={() => setShowReceipt(false)}>
                  ✕
                </button>
              </div>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <div className="stack" style={{ minWidth: 240 }}>
                  <label className="muted">Receipt (jpg/png)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadReceipt(f);
                    }}
                  />
                </div>
              </div>
              {status && (
                <div className="muted" style={{ marginTop: 8 }}>
                  {status}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
