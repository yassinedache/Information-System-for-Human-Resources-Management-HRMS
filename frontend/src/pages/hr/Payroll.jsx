import { useState } from "react";
import { BadgeCheck, Calculator, ChevronLeft, ChevronRight, Eye, Loader2, Wallet } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, Notice, Person, StatusBadge, useApi, useConfirm, useToast } from "../../ui.jsx";
import { PayslipModal } from "../Payslip.jsx";

function shiftMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** bonus / advance of a draft payslip, saved when the field loses focus */
function AmountCell({ p, field, onSaved }) {
  const i = useI18n();
  const toast = useToast();
  const [value, setValue] = useState(String(Number(p[field])));
  const [busy, setBusy] = useState(false);
  if (p.status !== "draft") return <span>{Number(p[field]) ? i.amount(p[field]) : "—"}</span>;
  const save = async () => {
    if (Number(value) === Number(p[field])) return;
    setBusy(true);
    try {
      onSaved(await api.patch(`/payslips/${p.id}/`, { [field]: value || "0" }));
    } catch (err) {
      toast(i.error(err), "error");
      setValue(String(Number(p[field])));
    } finally {
      setBusy(false);
    }
  };
  return (
    <input className="input inline-num" type="number" min="0" step="500" value={value} disabled={busy}
      onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      aria-label={i.t("slip." + field) + " · " + p.employee_name} />
  );
}

export default function Payroll() {
  const i = useI18n();
  const { t } = i;
  const { today } = useAuth();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [busy, setBusy] = useState("");
  const [viewing, setViewing] = useState(null);
  const q = useApi(() => api.get("/payslips/", { period }), [period]);

  const run = async (what) => {
    setBusy(what);
    try {
      if (what === "generate") {
        const r = await api.post("/payslips/generate/", { period });
        toast(t("payroll.generated", { c: r.created, u: r.updated, s: r.skipped_validated }));
      } else {
        if (!(await confirm(t("payroll.validate_all_confirm", { month: i.month(period + "-01") }), { danger: false, label: t("payroll.validate_all") }))) return;
        const r = await api.post("/payslips/validate-all/", { period });
        toast(t("payroll.validated_n", { n: r.validated }));
      }
      q.reload();
    } catch (err) {
      toast(i.error(err), "error");
    } finally {
      setBusy("");
    }
  };

  const validateOne = async (p) => {
    try {
      const v = await api.post(`/payslips/${p.id}/validate/`, {});
      q.setData((rows) => rows.map((x) => (x.id === v.id ? v : x)));
      toast(t("payroll.validated_one", { name: p.employee_name }));
    } catch (err) {
      toast(i.error(err), "error");
    }
  };

  const replace = (v) => q.setData((rows) => rows.map((x) => (x.id === v.id ? v : x)));

  return (
    <>
      <div className="page-head">
        <div><h1>{t("payroll.title")}</h1><p>{t("payroll.sub")}</p></div>
        <div className="row">
          <button className="btn icon" onClick={() => setPeriod(shiftMonth(period, -1))} aria-label={t("payroll.prev")}><ChevronLeft size={18} /></button>
          <input className="input" type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} style={{ width: "auto" }} aria-label={t("payroll.period")} />
          <button className="btn icon" onClick={() => setPeriod(shiftMonth(period, 1))} aria-label={t("payroll.next")}><ChevronRight size={18} /></button>
        </div>
      </div>
      <Async q={q}>
        {(rows) => {
          const drafts = rows.filter((p) => p.status === "draft").length;
          const sum = (k) => rows.reduce((a, p) => a + Number(p[k]), 0);
          return (
            <>
              <div className="grid stats">
                <div className="card stat"><div className="ico"><Wallet size={22} /></div><div><h3>{t("payroll.total_gross")}</h3><div className="value">{i.money(sum("gross"))}</div><div className="sub">{t("payroll.slips_n", { n: rows.length })}</div></div></div>
                <div className="card stat"><div className="ico green"><Wallet size={22} /></div><div><h3>{t("payroll.total_net")}</h3><div className="value">{i.money(sum("net"))}</div><div className="sub">{t("payroll.social_total", { x: i.money(sum("social_security")) })}</div></div></div>
                <div className="card stat"><div className="ico orange"><Calculator size={22} /></div><div><h3>{t("payroll.drafts")}</h3><div className="value">{drafts}</div><div className="sub">{t("payroll.validated_count", { n: rows.length - drafts })}</div></div></div>
              </div>
              <div className="card">
                <div className="card-head">
                  <div><h3 style={{ textTransform: "capitalize" }}>{i.month(period + "-01")}</h3><span className="muted small">{t("payroll.amounts_in")}</span></div>
                  <div className="row">
                    <button className="btn" onClick={() => run("generate")} disabled={!!busy}>
                      {busy === "generate" ? <Loader2 size={16} className="spin" /> : <Calculator size={16} />}{rows.length ? t("payroll.recompute") : t("payroll.generate")}
                    </button>
                    <button className="btn primary" onClick={() => run("validate")} disabled={!!busy || !drafts}>
                      {busy === "validate" ? <Loader2 size={16} className="spin" /> : <BadgeCheck size={16} />}{t("payroll.validate_all")}
                    </button>
                  </div>
                </div>
                {rows.length > 0 && <div className="card-body" style={{ paddingBottom: 0 }}><Notice>{t("payroll.rule")}</Notice></div>}
                {rows.length ? (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="table compact">
                      <thead><tr>
                        <th>{t("field.employee")}</th><th className="right hide-md">{t("slip.base_salary")}</th><th className="right">{t("slip.bonus")}</th>
                        <th className="right">{t("slip.absences")}</th><th className="right">{t("slip.gross")}</th><th className="right hide-lg">{t("slip.social_short")}</th>
                        <th className="right" title={t("slip.advance")}>{t("slip.advance_short")}</th><th className="right">{t("slip.net")}</th><th>{t("field.status")}</th><th />
                      </tr></thead>
                      <tbody>
                        {rows.map((p) => (
                          <tr key={p.id}>
                            <td><Person name={p.employee_name} sub={`${t("contract." + p.contract_type)}${p.prorata_days < 28 ? " · " + t("payroll.prorata", { n: p.prorata_days }) : ""}`} /></td>
                            <td className="num hide-md">{i.amount(p.base_salary)}</td>
                            <td className="num"><AmountCell key={p.id + p.status + p.bonus} p={p} field="bonus" onSaved={replace} /></td>
                            <td className="num">{p.absence_days + p.unpaid_leave_days ? <span title={t("slip.absences_detail", { a: p.absence_days, u: p.unpaid_leave_days })}>−{i.amount(p.absence_deduction)}</span> : "—"}</td>
                            <td className="num">{i.amount(p.gross)}</td>
                            <td className="num hide-lg">−{i.amount(p.social_security)}</td>
                            <td className="num"><AmountCell key={p.id + p.status + p.advance} p={p} field="advance" onSaved={replace} /></td>
                            <td className="num"><b>{i.amount(p.net)}</b></td>
                            <td><StatusBadge group="pstatus" value={p.status} /></td>
                            <td>
                              <div className="actions">
                                <button className="btn ghost sm icon" title={t("payroll.view")} aria-label={t("payroll.view")} onClick={() => setViewing(p)}><Eye size={15} /></button>
                                {p.status === "draft" && <button className="btn success sm icon" title={t("payroll.validate")} aria-label={t("payroll.validate")} onClick={() => validateOne(p)}><BadgeCheck size={15} /></button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty icon={Wallet}>{t("payroll.none")}</Empty>}
              </div>
            </>
          );
        }}
      </Async>
      {viewing && <PayslipModal payslip={viewing} onClose={() => setViewing(null)} />}
      {confirmNode}
    </>
  );
}
