"use client";

import { useEffect, useState } from "react";
import { getMe, getToken } from "@/lib/backendClient";
import Sidebar from "../dashboard/Sidebar";
import styles from "../dashboard/page.module.css";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const STATIC_USER_ID = "static-user";
const INCOME_KEY = "fin_brawl_monthly_income";
const FIXED_KEY = "fin_brawl_fixed_costs";

export default function AdvisingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about your spending, or whether you can afford something.",
    },
  ]);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(4000);
  const [fixedCosts, setFixedCosts] = useState<number>(1500);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedIncome = window.localStorage.getItem(INCOME_KEY);
    const storedFixed = window.localStorage.getItem(FIXED_KEY);
    if (storedIncome) setMonthlyIncome(Number(storedIncome));
    if (storedFixed) setFixedCosts(Number(storedFixed));
  }, []);

  useEffect(() => {
    if (STATIC_MODE) {
      setUserId(STATIC_USER_ID);
      setUsername("static-user");
      setStatus("Static mode enabled — chat disabled.");
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
    setChat((prev) => [...prev, { role: "assistant", content: out.reply }]);
  }

  return (
    <div className={`row ${styles.layout} page-body page--advising`}>
      <Sidebar active="advising" username={username} status={status} />

      <div className={`stack ${styles.content}`}>
        <div className={styles.chatRightPane}>
          <div className={styles.chatRightInner}>
            <div className={`brand-font ${styles.chatTagline}`}>
              Hi! Ask me about your spending, or whether you can afford something.
            </div>
            <div className={styles.chatInputCenter}>
              <textarea
                className={styles.chatInputLarge}
                placeholder='e.g., "Spent $45 on Uber yesterday" or "Can I afford a $2000 trip?"'
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                rows={5}
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
