"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { getIncomes, getMe, getToken, type BackendIncome } from "@/lib/backendClient";
import Sidebar from "../dashboard/Sidebar";
import styles from "../dashboard/page.module.css";

type ChatMsg = { role: "user" | "assistant"; content: string };
type PendingChat = { message: string; created_at: string };

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === "true";
const STATIC_USER_ID = "static-user";
const FIXED_KEY = "fin_brawl_fixed_costs";
const CHAT_HISTORY_KEY = "fin_brawl_advising_history_v1";
const CHAT_PENDING_KEY = "fin_brawl_advising_pending_v1";
const DEFAULT_CHAT: ChatMsg[] = [
  {
    role: "assistant",
    content:
      "Hi! Ask me about your spending, or whether you can afford something.",
  },
];

function isChatMsg(value: unknown): value is ChatMsg {
  if (!value || typeof value !== "object") return false;
  const item = value as { role?: unknown; content?: unknown };
  return (
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string"
  );
}

function parseStoredChat(raw: string | null): ChatMsg[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(isChatMsg);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function parsePendingChat(raw: string | null): PendingChat | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const item = parsed as { message?: unknown; created_at?: unknown };
    if (typeof item.message !== "string" || !item.message.trim()) return null;
    if (typeof item.created_at !== "string") return null;
    return { message: item.message, created_at: item.created_at };
  } catch {
    return null;
  }
}

export default function AdvisingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [displayChat, setDisplayChat] = useState<ChatMsg[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>(DEFAULT_CHAT);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [fixedCosts, setFixedCosts] = useState<number>(0);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const skipTypingRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedFixed = window.localStorage.getItem(FIXED_KEY);
    if (storedFixed !== null) {
      setFixedCosts(Number(storedFixed));
    }
  }, []);

  useEffect(() => {
    setDisplayChat(DEFAULT_CHAT);
  }, []);

  useEffect(() => {
    if (STATIC_MODE) {
      setUserId(STATIC_USER_ID);
      setUsername("static-user");
      setStatus("Static mode enabled — chat disabled.");
      setIdentityReady(true);
      return;
    }
    (async () => {
      const token = getToken();
      if (!token) {
        setStatus("Guest mode: general answers only. Log in for personalized insights.");
        setIdentityReady(true);
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
      } finally {
        setIdentityReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!identityReady || typeof window === "undefined") return;
    const scope = userId ?? "guest";
    const nextHistoryKey = `${CHAT_HISTORY_KEY}:${scope}`;
    const nextPendingKey = `${CHAT_PENDING_KEY}:${scope}`;
    setHistoryKey(nextHistoryKey);
    setPendingKey(nextPendingKey);
    const restored = parseStoredChat(window.localStorage.getItem(nextHistoryKey));
    const nextChat = restored ?? DEFAULT_CHAT;
    skipTypingRef.current = true;
    setChat(nextChat);
    setDisplayChat(nextChat);
    setIsTyping(false);
  }, [identityReady, userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !historyKey) return;
    window.localStorage.setItem(historyKey, JSON.stringify(chat));
  }, [chat, historyKey]);

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

  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, []);

  const scrollChatToBottom = useCallback(() => {
    const el = chatLogRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  function handleChatInputChange(value: string) {
    setChatInput(value);
    window.requestAnimationFrame(scrollChatToBottom);
  }

  function startNewAdvisingSession() {
    skipTypingRef.current = true;
    setChat(DEFAULT_CHAT);
    setDisplayChat(DEFAULT_CHAT);
    setIsTyping(false);
    setChatInput("");
    setStatus("");
    if (typeof window !== "undefined" && historyKey) {
      window.localStorage.setItem(historyKey, JSON.stringify(DEFAULT_CHAT));
    }
    if (typeof window !== "undefined" && pendingKey) {
      window.localStorage.removeItem(pendingKey);
    }
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
      activeRequestRef.current = null;
    }
  }

  const requestAssistantReply = useCallback(
    async (msg: string, mode: "new" | "resume") => {
      if (STATIC_MODE) return;
      if (!msg.trim()) return;
      if (typeof window !== "undefined" && pendingKey) {
        window.localStorage.setItem(
          pendingKey,
          JSON.stringify({ message: msg, created_at: new Date().toISOString() })
        );
      }
      setStatus(mode === "resume" ? "Resuming previous response..." : "Thinking...");

      const controller = new AbortController();
      activeRequestRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            message: msg,
            finance: { monthlyIncome, fixedCosts },
            token: getToken(),
          }),
          signal: controller.signal,
        });
        const out = (await res.json().catch(() => ({}))) as {
          error?: string;
          reply?: string;
        };
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setStatus(out.error || "Chat failed");
          setChat((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry — something went wrong." },
          ]);
          if (typeof window !== "undefined" && pendingKey) {
            window.localStorage.removeItem(pendingKey);
          }
          return;
        }

        const reply =
          typeof out.reply === "string" && out.reply.trim()
            ? out.reply
            : "Sorry — something went wrong.";
        setStatus("");
        setChat((prev) => [...prev, { role: "assistant", content: reply }]);
        if (typeof window !== "undefined" && pendingKey) {
          window.localStorage.removeItem(pendingKey);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setStatus(e instanceof Error ? e.message : "Chat failed");
        setChat((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry — something went wrong." },
        ]);
        if (typeof window !== "undefined" && pendingKey) {
          window.localStorage.removeItem(pendingKey);
        }
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
      }
    },
    [fixedCosts, monthlyIncome, pendingKey, userId]
  );

  useEffect(() => {
    if (STATIC_MODE || typeof window === "undefined" || !pendingKey) return;
    if (activeRequestRef.current) return;
    const pending = parsePendingChat(window.localStorage.getItem(pendingKey));
    if (!pending) return;
    void requestAssistantReply(pending.message, "resume");
  }, [pendingKey, requestAssistantReply]);

  function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    if (activeRequestRef.current) {
      setStatus("Please wait for the current response.");
      return;
    }
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
    void requestAssistantReply(msg, "new");
  }

  useEffect(() => {
    if (skipTypingRef.current) {
      skipTypingRef.current = false;
      setDisplayChat(chat);
      setIsTyping(false);
      return;
    }
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

  useEffect(() => {
    if (!showLog) return;
    const id = window.requestAnimationFrame(scrollChatToBottom);
    return () => window.cancelAnimationFrame(id);
  }, [chatInput, displayChat, scrollChatToBottom, showLog, status]);

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
                      onChange={(e) => handleChatInputChange(e.target.value)}
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
                <div className={styles.chatSessionRow}>
                  <button
                    type="button"
                    className={styles.chatSessionButton}
                    onClick={startNewAdvisingSession}
                  >
                    Start new advising session
                  </button>
                </div>
                <div className={styles.chatLog} ref={chatLogRef}>
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
                  {(status === "Thinking..." ||
                    status === "Resuming previous response...") &&
                    !isTyping && (
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
                      onChange={(e) => handleChatInputChange(e.target.value)}
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
