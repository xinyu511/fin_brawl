"use client";

import Link from "next/link";
import { clearToken } from "@/lib/backendClient";
import styles from "./page.module.css";

type TabKey = "overview" | "transactions" | "advising" | "account";

type SidebarProps = {
  active: TabKey;
  username: string | null;
  status?: string;
  title?: string;
};

function tabClass(active: TabKey, key: TabKey): string {
  return `${styles.tab} ${active === key ? styles.tabActive : ""}`.trim();
}

export default function Sidebar({ active, username, status, title }: SidebarProps) {
  function signOut() {
    clearToken();
    window.location.href = "/";
  }

  function goLogin() {
    window.location.href = "/login";
  }

  const showStatus = status && status !== "not_found";
  const isLoggedIn = Boolean(username);

  return (
    <aside className={`card ${styles.sidebar}`}>
      <div className={`brand-font ${styles.sidebarTitle}`}>{title || "PiggyBot"}</div>
      <div className={`stack ${styles.sidebarNav}`}>
        <Link className={tabClass(active, "overview")} href="/dashboard">
          Overview
        </Link>
        <Link className={tabClass(active, "transactions")} href="/transactions">
          Transactions
        </Link>
        <Link className={tabClass(active, "advising")} href="/advising">
          Advising
        </Link>
        <Link className={tabClass(active, "account")} href="/account">
          Account
        </Link>
      </div>
      <div className={styles.sidebarBottom}>
        <div className={`muted ${styles.sidebarMeta}`}>
          User: {username ?? "Not logged in"}
        </div>
        <button
          className={`${styles.tab} ${styles.tabButton}`}
          onClick={isLoggedIn ? signOut : goLogin}
        >
          {isLoggedIn ? "Logout" : "Login"}
        </button>
        {showStatus && <div className={`muted ${styles.sidebarStatus}`}>{status}</div>}
      </div>
    </aside>
  );
}
