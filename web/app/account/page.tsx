"use client";

import { useEffect, useState } from "react";
import { getMe, getProfile, updateProfile } from "@/lib/backendClient";
import styles from "../dashboard/page.module.css";
import accountStyles from "./page.module.css";
import Sidebar from "../dashboard/Sidebar";

type Status = { kind: "idle" | "loading" | "error" | "saved"; text: string };

type ProfileForm = {
  username: string;
  currency: string;
  netWorth: string;
  riskTolerance: "" | "low" | "medium" | "high";
  financialGoal: "" | "save" | "invest" | "retire" | "reduce_debt";
  timeHorizon: "" | "short" | "medium" | "long";
  ageRange: string;
  location: string;
};

const emptyForm: ProfileForm = {
  username: "",
  currency: "USD",
  netWorth: "",
  riskTolerance: "",
  financialGoal: "",
  timeHorizon: "",
  ageRange: "",
  location: "",
};

export default function AccountPage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  useEffect(() => {
    (async () => {
      setStatus({ kind: "loading", text: "Loading profile..." });
      try {
        const [me, profileResp] = await Promise.all([getMe(), getProfile()]);
        const p = profileResp.profile;
        setForm({
          username: me.username,
          currency: p.currency || "USD",
          netWorth: p.net_worth_cents != null ? String(p.net_worth_cents / 100) : "",
          riskTolerance: p.risk_tolerance ?? "",
          financialGoal: p.financial_goal ?? "",
          timeHorizon: p.time_horizon ?? "",
          ageRange: p.age_range ?? "",
          location: p.location ?? "",
        });
        setStatus({ kind: "idle", text: "" });
      } catch (e) {
        setStatus({
          kind: "error",
          text: e instanceof Error ? e.message : "Failed to load profile.",
        });
      }
    })();
  }, []);

  async function onSave() {
    setStatus({ kind: "loading", text: "Saving..." });
    try {
      const netWorthTrim = form.netWorth.trim();
      const netWorthCents =
        netWorthTrim === "" ? null : Math.round(Number(netWorthTrim) * 100);
      if (netWorthTrim !== "" && Number.isNaN(netWorthCents)) {
        setStatus({ kind: "error", text: "Net worth must be a valid number." });
        return;
      }
      const resp = await updateProfile({
        currency: form.currency,
        net_worth_cents: netWorthCents,
        risk_tolerance: form.riskTolerance || null,
        financial_goal: form.financialGoal || null,
        time_horizon: form.timeHorizon || null,
        age_range: form.ageRange || null,
        location: form.location || null,
      });
      const p = resp.profile;
      setForm((prev) => ({
        ...prev,
        currency: p.currency || "USD",
        netWorth: p.net_worth_cents != null ? String(p.net_worth_cents / 100) : "",
        riskTolerance: p.risk_tolerance ?? "",
        financialGoal: p.financial_goal ?? "",
        timeHorizon: p.time_horizon ?? "",
      }));
      setStatus({ kind: "saved", text: "Saved." });
    } catch (e) {
      setStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Failed to save profile.",
      });
    }
  }

  return (
    <div className={`row ${styles.layout} page-body`}>
      <Sidebar
        active="account"
        username={form.username || null}
        status={status.text}
        title="Account"
      />
      <div className={`stack ${styles.content}`}>
        <div className={`card ${accountStyles.accountCard}`}>
          <h3 style={{ marginTop: 0 }}>Personal Information</h3>
          <p className="muted">
            Update your financial profile. Changes are saved to your account.
          </p>
          <div className={accountStyles.formGrid}>
            <div className={accountStyles.field}>
              <label>Username</label>
              <input value={form.username} disabled />
            </div>

            <div className={accountStyles.field}>
              <label>Currency</label>
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>

            <div className={accountStyles.field}>
              <label>Net worth (USD)</label>
              <input
                type="number"
                placeholder="e.g., 25000"
                value={form.netWorth}
                onChange={(e) => setForm({ ...form, netWorth: e.target.value })}
              />
            </div>

            <div className={accountStyles.field}>
              <label>Risk tolerance</label>
              <select
                value={form.riskTolerance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    riskTolerance:
                      e.target.value as ProfileForm["riskTolerance"],
                  })
                }
              >
                <option value="">Select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className={accountStyles.field}>
              <label>Financial goal</label>
              <select
                value={form.financialGoal}
                onChange={(e) =>
                  setForm({
                    ...form,
                    financialGoal:
                      e.target.value as ProfileForm["financialGoal"],
                  })
                }
              >
                <option value="">Select...</option>
                <option value="save">Save</option>
                <option value="invest">Invest</option>
                <option value="retire">Retire</option>
                <option value="reduce_debt">Reduce debt</option>
              </select>
            </div>

            <div className={accountStyles.field}>
              <label>Time horizon</label>
              <select
                value={form.timeHorizon}
                onChange={(e) =>
                  setForm({
                    ...form,
                    timeHorizon: e.target.value as ProfileForm["timeHorizon"],
                  })
                }
              >
                <option value="">Select...</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>

            <div className={accountStyles.field}>
              <label>Age range</label>
              <input
                placeholder="e.g., 25-34"
                value={form.ageRange}
                onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
              />
            </div>

            <div className={accountStyles.field}>
              <label>Location</label>
              <input
                placeholder="e.g., PA, US"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className={accountStyles.formActions}>
              <button onClick={onSave} disabled={status.kind === "loading"}>
                Save
              </button>
              {status.text && <div className="muted">{status.text}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
