import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, FilePlus2, KeyRound, Mail, Pencil, Phone, Power, Trash2 } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, Avatar, Empty, PasswordReveal, StatusBadge, useApi, useConfirm, useToast } from "../../ui.jsx";
import { PayslipModal } from "../Payslip.jsx";
import { ContractForm, ContractRows, useContractActions } from "./Contracts.jsx";
import { EmployeeForm } from "./Employees.jsx";
import { LeaveForm, LeaveRows, useLeaveActions } from "./Leaves.jsx";

export function BalanceCard({ balance, title }) {
  const i = useI18n();
  const { t } = i;
  const used = balance.entitlement ? Math.min(100, ((balance.taken + balance.pending) / balance.entitlement) * 100) : 0;
  return (
    <div className="card">
      <div className="card-head"><h3>{title || t("balance.title", { year: balance.year })}</h3></div>
      <div className="card-body stack">
        <div className="row between">
          <div><div className="muted small">{t("balance.available")}</div><div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>{i.num(balance.available)} <span className="small muted">{t("balance.days")}</span></div></div>
        </div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${used}%` }} /></div>
        <dl className="kv small">
          <dt>{t("balance.entitlement")}</dt><dd>{i.num(balance.entitlement)} {t("balance.days")}</dd>
          <dt>{t("balance.taken")}</dt><dd>{balance.taken} {t("balance.days")}</dd>
          <dt>{t("balance.pending")}</dt><dd>{balance.pending} {t("balance.days")}</dd>
        </dl>
        <p className="muted small">{t("balance.rule")}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmNode] = useConfirm();
  const [modal, setModal] = useState(null);           // "edit" | "contract" | "leave" | {contract} | {payslip} | {password}
  const q = useApi(() => api.get(`/employees/${id}/`), [id]);
  const contracts = useContractActions(q.reload);
  const leaves = useLeaveActions(q.reload);

  const act = async (fn, message) => {
    try {
      const r = await fn();
      if (message) toast(message);
      q.reload();
      return r;
    } catch (err) {
      toast(i.error(err), "error");
      return null;
    }
  };

  return (
    <>
      <div><Link to="/hr/employees" className="btn ghost sm"><ArrowLeft size={16} />{t("employees.back")}</Link></div>
      <Async q={q}>
        {(e) => {
          const name = `${e.first_name} ${e.last_name}`;
          const inactive = e.status === "inactive";
          return (
            <>
              <div className="card pad">
                <div className="profile-head">
                  <Avatar first={e.first_name} last={e.last_name} size="lg" />
                  <div className="grow" style={{ minWidth: 200 }}>
                    <div className="row"><h1>{name}</h1><StatusBadge group="emp" value={e.state} /></div>
                    <div className="muted">{e.position || "—"} · {e.service_name}</div>
                    <div className="row small" style={{ marginTop: 6, gap: 16 }}>
                      <a href={`mailto:${e.email}`} className="row" style={{ gap: 5 }}><Mail size={14} />{e.email}</a>
                      {e.phone && <span className="row muted" style={{ gap: 5 }}><Phone size={14} />{e.phone}</span>}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => setModal("edit")}><Pencil size={15} />{t("common.edit")}</button>
                    <button className="btn" onClick={async () => {
                      if (!(await confirm(e.has_account ? t("employees.reset_confirm", { name }) : t("employees.account_confirm", { name }), { danger: false, label: t("common.confirm") }))) return;
                      const r = await act(() => api.post(`/employees/${e.id}/reset-password/`, {}));
                      if (r) setModal({ password: r.temporary_password });
                    }}><KeyRound size={15} />{e.has_account ? t("employees.reset_password") : t("employees.create_login")}</button>
                    {inactive ? (
                      <button className="btn success" onClick={() => act(() => api.post(`/employees/${e.id}/reactivate/`, {}), t("employees.reactivated"))}><Power size={15} />{t("employees.reactivate")}</button>
                    ) : (
                      <button className="btn danger" onClick={async () => {
                        if (await confirm(t("employees.deactivate_confirm", { name }), { label: t("employees.deactivate") })) act(() => api.post(`/employees/${e.id}/deactivate/`, {}), t("employees.deactivated"));
                      }}><Power size={15} />{t("employees.deactivate")}</button>
                    )}
                    <button className="btn ghost icon" title={t("common.delete")} aria-label={t("common.delete")} onClick={async () => {
                      if (!(await confirm(t("employees.delete_confirm", { name }), { label: t("common.delete") }))) return;
                      try {
                        await api.del(`/employees/${e.id}/`);
                        toast(t("employees.deleted"));
                        navigate("/hr/employees");
                      } catch (err) { toast(i.error(err), "error"); }
                    }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>

              <div className="grid three">
                <div className="card">
                  <div className="card-head"><h3>{t("employees.info")}</h3></div>
                  <div className="card-body">
                    <dl className="kv">
                      <dt>{t("field.hire_date")}</dt><dd>{i.date(e.hire_date)}</dd>
                      <dt>{t("field.birth_date")}</dt><dd>{i.date(e.birth_date)}</dd>
                      <dt>{t("field.address")}</dt><dd>{e.address || "—"}</dd>
                      <dt>{t("employees.account")}</dt><dd>{e.has_account ? <span className="badge green">{t("employees.has_account")}</span> : <span className="badge">{t("employees.no_account")}</span>}</dd>
                      <dt>{t("field.skills")}</dt>
                      <dd>{e.skills ? <div className="chips">{e.skills.split(",").map((s) => s.trim()).filter(Boolean).map((s) => <span key={s} className="chip">{s}</span>)}</div> : "—"}</dd>
                    </dl>
                  </div>
                </div>
                <BalanceCard balance={e.balance} />
                <div className="card">
                  <div className="card-head"><h3>{t("employees.this_month")}</h3></div>
                  <div className="card-body stack">
                    <div className="mini-stat" style={{ justifyContent: "space-between" }}><StatusBadge group="att" value="present" /><b>{t("common.days_n", { n: e.attendance_month.present })}</b></div>
                    <div className="mini-stat" style={{ justifyContent: "space-between" }}><StatusBadge group="att" value="absent" /><b>{t("common.days_n", { n: e.attendance_month.absent })}</b></div>
                    {e.contract && (
                      <dl className="kv small">
                        <dt>{t("field.contract")}</dt><dd>{t("contract." + e.contract.type + "_long")}</dd>
                        <dt>{t("field.monthly_salary")}</dt><dd>{i.money(e.contract.monthly_salary)}</dd>
                      </dl>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>{t("nav.contracts")}</h3>
                  {!inactive && <button className="btn sm" onClick={() => setModal("contract")}><FilePlus2 size={15} />{t("contracts.new")}</button>}
                </div>
                {e.contracts.length ? <ContractRows rows={e.contracts} showEmployee={false} onEdit={(c) => setModal({ contract: c })} onArchive={contracts.archive} />
                  : <Empty>{t("contracts.none")}</Empty>}
              </div>

              <div className="card">
                <div className="card-head">
                  <h3>{t("nav.leaves")}</h3>
                  {!inactive && <button className="btn sm" onClick={() => setModal("leave")}><CalendarPlus size={15} />{t("leaves.new")}</button>}
                </div>
                {e.leaves.length ? <LeaveRows rows={e.leaves} showEmployee={false} onDecide={leaves.decide} onCancel={leaves.cancel} />
                  : <Empty>{t("leaves.none")}</Empty>}
              </div>

              <div className="card">
                <div className="card-head"><h3>{t("nav.me_payslips_hr")}</h3></div>
                {e.payslips.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>{t("payroll.period")}</th><th className="right">{t("slip.gross")}</th><th className="right">{t("slip.net")}</th><th>{t("field.status")}</th></tr></thead>
                      <tbody>
                        {e.payslips.map((p) => (
                          <tr key={p.id} className="click" onClick={() => setModal({ payslip: p })}>
                            <td style={{ textTransform: "capitalize" }}>{i.month(p.period)}</td>
                            <td className="num">{i.money(p.gross)}</td>
                            <td className="num"><b>{i.money(p.net)}</b></td>
                            <td><StatusBadge group="pstatus" value={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty>{t("payroll.none_employee")}</Empty>}
              </div>

              {modal === "edit" && <EmployeeForm employee={e} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast(t("employees.saved")); q.reload(); }} />}
              {modal === "contract" && <ContractForm employeeId={e.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast(t("contracts.saved")); q.reload(); }} />}
              {modal && modal.contract && <ContractForm contract={modal.contract} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast(t("contracts.saved")); q.reload(); }} />}
              {modal === "leave" && <LeaveForm employeeId={e.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); toast(t("leaves.created")); q.reload(); }} />}
              {modal && modal.payslip && <PayslipModal payslip={modal.payslip} onClose={() => setModal(null)} />}
              {modal && modal.password && <PasswordReveal name={`${name} (${e.email})`} password={modal.password} onClose={() => setModal(null)} />}
            </>
          );
        }}
      </Async>
      {contracts.confirmNode}
      {leaves.node}
      {confirmNode}
    </>
  );
}
