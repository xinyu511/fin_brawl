"use client";

import { useEffect, useState } from "react";
import {
  addIncome,
  deleteIncome,
  getIncomes,
  getMe,
  getProfile,
  updateProfile,
  type BackendIncome,
} from "@/lib/backendClient";
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

type IncomeForm = {
  amount: string;
  source: string;
  startDate: string;
  endDate: string;
};

const emptyIncomeForm: IncomeForm = {
  amount: "",
  source: "",
  startDate: "",
  endDate: "",
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function AccountPage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [profileStatus, setProfileStatus] = useState<Status>({
    kind: "idle",
    text: "",
  });
  const [incomeStatus, setIncomeStatus] = useState<Status>({
    kind: "idle",
    text: "",
  });
  const [incomeForm, setIncomeForm] = useState<IncomeForm>(emptyIncomeForm);
  const [incomes, setIncomes] = useState<BackendIncome[]>([]);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setProfileStatus({ kind: "loading", text: "Loading profile..." });
      try {
        const [me, profileResp, incomeRows] = await Promise.all([
          getMe(),
          getProfile(),
          getIncomes(),
        ]);
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
        setIncomes(incomeRows);
        setProfileStatus({ kind: "idle", text: "" });
        setIncomeStatus({ kind: "idle", text: "" });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load profile.";
        setProfileStatus({
          kind: "error",
          text: message,
        });
        setIncomeStatus({ kind: "error", text: message });
      }
    })();
  }, []);

  async function refreshIncomes() {
    const rows = await getIncomes();
    setIncomes(rows);
  }

  async function onSave() {
    setProfileStatus({ kind: "loading", text: "Saving..." });
    try {
      const netWorthTrim = form.netWorth.trim();
      const netWorthCents =
        netWorthTrim === "" ? null : Math.round(Number(netWorthTrim) * 100);
      if (netWorthTrim !== "" && Number.isNaN(netWorthCents)) {
        setProfileStatus({
          kind: "error",
          text: "Net worth must be a valid number.",
        });
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
        ageRange: p.age_range ?? "",
        location: p.location ?? "",
      }));
      setProfileStatus({ kind: "saved", text: "Saved." });
    } catch (e) {
      setProfileStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Failed to save profile.",
      });
    }
  }

  async function onAddIncome() {
    const amountText = incomeForm.amount.trim().replace(/,/g, "");
    const source = incomeForm.source.trim();
    const amount = Number.parseFloat(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) {
      setIncomeStatus({
        kind: "error",
        text: "Income amount must be a positive number.",
      });
      return;
    }
    if (!source) {
      setIncomeStatus({ kind: "error", text: "Income source is required." });
      return;
    }
    setIncomeStatus({ kind: "loading", text: "Adding income..." });
    try {
      await addIncome({
        amount_cents: Math.round(amount * 100),
        source,
        start_date: incomeForm.startDate || null,
        end_date: incomeForm.endDate || null,
      });
      setIncomeForm(emptyIncomeForm);
      await refreshIncomes();
      setIncomeStatus({ kind: "saved", text: "Income added." });
    } catch (e) {
      setIncomeStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Failed to add income.",
      });
    }
  }

  async function onDeleteIncome(id: string) {
    setDeletingIncomeId(id);
    setIncomeStatus({ kind: "loading", text: "Deleting income..." });
    try {
      await deleteIncome(id);
      await refreshIncomes();
      setIncomeStatus({ kind: "saved", text: "Income deleted." });
    } catch (e) {
      setIncomeStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Failed to delete income.",
      });
    } finally {
      setDeletingIncomeId(null);
    }
  }

  return (
    <div className={`row ${styles.layout} page-body`}>
      <Sidebar
        active="account"
        username={form.username || null}
        status={profileStatus.text || incomeStatus.text}
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
              <button
                onClick={onSave}
                disabled={profileStatus.kind === "loading"}
              >
                Save
              </button>
              {profileStatus.text && <div className="muted">{profileStatus.text}</div>}
            </div>
          </div>

          <div className={accountStyles.sectionDivider} />

          <h3>Income</h3>
          <p className="muted">
            Add monthly income sources to your account. You can delete entries
            from the list at any time.
          </p>
          <div className={accountStyles.incomeGrid}>
            <div className={accountStyles.field}>
              <label>Monthly amount</label>
              <input
                type="number"
                placeholder="e.g., 4500"
                value={incomeForm.amount}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>
            <div className={accountStyles.field}>
              <label>Source</label>
              <input
                placeholder="e.g., Salary"
                value={incomeForm.source}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, source: e.target.value }))
                }
              />
            </div>
            <div className={accountStyles.field}>
              <label>Start date (optional)</label>
              <input
                type="date"
                value={incomeForm.startDate}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>
            <div className={accountStyles.field}>
              <label>End date (optional)</label>
              <input
                type="date"
                value={incomeForm.endDate}
                onChange={(e) =>
                  setIncomeForm((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </div>
            <div className={accountStyles.formActions}>
              <button
                onClick={onAddIncome}
                disabled={incomeStatus.kind === "loading"}
              >
                Add income
              </button>
              {incomeStatus.text && <div className="muted">{incomeStatus.text}</div>}
            </div>
          </div>

          <div className={accountStyles.listWrap}>
            {incomes.length === 0 ? (
              <div className="muted">No income records yet.</div>
            ) : (
              <table className={accountStyles.incomeTable}>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Added</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((income) => (
                    <tr key={income.id}>
                      <td>{income.source}</td>
                      <td>{formatMoney(income.amount, form.currency)}</td>
                      <td>{income.start_date || "-"}</td>
                      <td>{income.end_date || "-"}</td>
                      <td>{income.created_at?.slice(0, 10) || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className={accountStyles.deleteButton}
                          disabled={deletingIncomeId === income.id}
                          onClick={() => onDeleteIncome(income.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
