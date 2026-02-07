"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { getIncomes, getMe, getToken, type BackendIncome } from "@/lib/backendClient";
import Sidebar from "../dashboard/Sidebar";
import styles from "../dashboard/page.module.css";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const STATIC_USER_ID = "static-user";
const FIXED_KEY = "fin_brawl_fixed_costs";

export default function AdvisingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [displayChat, setDisplayChat] = useState<ChatMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about your spending, or whether you can afford something.",
    },
  ]);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [fixedCosts, setFixedCosts] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedFixed = window.localStorage.getItem(FIXED_KEY);
    if (storedFixed !== null) {
      setFixedCosts(Number(storedFixed));
    }
  }, []);

  useEffect(() => {
    setDisplayChat(chat);
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
        setStatus("Guest mode: general answers only. Log in for personalized insights.");
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

  useEffect(() => {
    if (!userId || STATIC_MODE) return;
    (async () => {
      try {
        const rows = await getIncomes();
        const total = rows.reduce(
          (acc: number, inc: BackendIncome) => acc + Number(inc.amount || 0),
          0
        );
        setMonthlyIncome(total);
      } catch {
        // Keep prior value; chat route will fall back if needed.
      }
    })();
  }, [userId]);

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

  useEffect(() => {
    const last = chat[chat.length - 1];
    if (!last || last.role !== "assistant") {
      setDisplayChat(chat);
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    const full = last.content;
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      const partial = full.slice(0, i);
      setDisplayChat([...chat.slice(0, -1), { ...last, content: partial }]);
      if (i >= full.length) {
        window.clearInterval(id);
        setIsTyping(false);
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [chat]);

  const hasUserInput = displayChat.some((msg) => msg.role === "user");
  const showLog = hasUserInput || displayChat.length > 1;

  return (
    <div className={`row ${styles.layout} page-body page--advising`}>
      <Sidebar active="advising" username={username} status={status} />

      <div className={`stack ${styles.content}`}>
        <div className={styles.chatRightPane}>
          <div className={styles.chatRightInner}>
            {!showLog && (
              <>
                <div className={`brand-font ${styles.chatTagline}`}>
                  Hi! Ask me about your spending, or whether you can afford something.
                </div>
                <div className={styles.chatInputBar}>
                  <div className={styles.chatInputWrap}>
                    <textarea
                      className={styles.chatInputLarge}
                      placeholder={
                        chatInput.length === 0
                          ? 'e.g., "Spent $45 on Uber yesterday" or "Can I afford a $2000 trip?"'
                          : ""
                      }
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      rows={3}
                    />
                    <button className={styles.chatSend} onClick={sendChat} aria-label="Send">
                      ✈
                    </button>
                  </div>
                </div>
              </>
            )}
            {showLog && (
              <div className={styles.chatCardShell}>
                <div className={styles.chatLog}>
                  {displayChat.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={`${styles.chatItem} ${
                        msg.role === "assistant"
                          ? styles.chatItemAssistant
                          : styles.chatItemUser
                      }`}
                    >
                      <span className={styles.chatBubble}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSanitize]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {isTyping && idx === displayChat.length - 1 ? (
                            <span className={styles.typingCursor}>▍</span>
                          ) : null}
                        </span>
                    </div>
                  ))}
                  {status === "Thinking..." && !isTyping && (
                    <div className={`${styles.chatItem} ${styles.chatItemAssistant}`}>
                      <span className={styles.chatBubble}>Thinking...</span>
                    </div>
                  )}
                </div>
                <div className={styles.chatInputBar}>
                  <div className={styles.chatInputWrap}>
                    <textarea
                      className={styles.chatInputLarge}
                      placeholder={
                        chatInput.length === 0
                          ? 'e.g., "Spent $45 on Uber yesterday" or "Can I afford a $2000 trip?"'
                          : ""
                      }
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      rows={3}
                    />
                    <button className={styles.chatSend} onClick={sendChat} aria-label="Send">
                      ✈
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
