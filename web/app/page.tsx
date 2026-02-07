"use client";

import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  return (
    <div className={`stack ${styles.hero}`}>
      <div className={`card ${styles.heroCard}`}>
        <h3 style={{ marginTop: 0 }}>Budget-Tracking LLM Website</h3>
        <div className={`row ${styles.centerRow}`}>
          <button className={styles.getStartedButton} type="button" onClick={() => router.push("/login")}>
            Get started
          </button>
        </div>
      </div>

      <div className={`card ${styles.heroCard}`}>
        <h4 style={{ marginTop: 0 }} className={styles.centerText}>Demo questions</h4>
        <ul className={`muted ${styles.centerList}`} style={{ marginBottom: 0 }}>
          <li>Why am I overspending this month?</li>
          <li>What should I cut first?</li>
          <li>Can I afford a $2000 trip?</li>
          <li>Which city should I live in to have a decent life?</li>
        </ul>
      </div>
    </div>
  );
}
