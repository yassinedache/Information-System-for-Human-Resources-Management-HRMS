import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, CalendarPlus, Check, Undo2, X } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { addDays, useI18n } from "../../i18n.jsx";
import {
  Async, Empty, Field, FormModal, Input, Notice, Person, Select, StatusBadge, Textarea, formObject, useApi, useConfirm,
  useToast, workingDays,
} from "../../ui.jsx";

export const LEAVE_TYPES = ["annual", "sick", "maternity", "paternity", "unpaid"];

/** Leave request form: used by HR (for any employee) and by employees (for themselves). */
export function LeaveForm({ employeeId, mine, onClose, onSaved }) {
  const { t } = useI18n();
  const { today, settings } = useAuth();
  const [type, setType] = useState("annual");
  const [start, setStart] = useState(addDays(today, 7));
  const [end, setEnd] = useState(addDays(today, 9));
  const employees = useApi(() => (employeeId || mine ? Promise.resolve([]) : api.get("/employees/", { status: "active" })));
  const days = workingDays(start, end, settings ? settings.weekend : undefined);
  return (
    <FormModal title={mine ? t("leaves.request") : t("leaves.new")} submitLabel={mine ? t("leaves.send") : t("common.save")} onClose={onClose}
      submit={async (fd) => {
        const data = formObject(fd);
        if (mine) return onSaved(await api.post("/me/leaves/", data));
        if (employeeId) data.employee = employeeId;
        return onSaved(await api.post("/leaves/", data));
      }}>
      <div className="form-grid">
        {!employeeId && !mine && (
          <Field label={t("field.employee")} name="employee" full>
            <Select name="employee" required placeholder={t("common.choose")} defaultValue=""
              options={(employees.data || []).map((e) => [e.id, `${e.last_name} ${e.first_name}`])} />
          </Field>
        )}
        <Field label={t("field.type")} name="type" full>
          <Select name="type" value={type} onChange={(e) => setType(e.target.value)} options={LEAVE_TYPES.map((k) => [k, t("leave." + k)])} />
        </Field>
        <Field label={t("field.start_date")} name="start_date">
          <Input name="start_date" type="date" required value={start} min={mine ? today : undefined}
            onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
        </Field>
        <Field label={t("field.end_date")} name="end_date">
          <Input name="end_date" type="date" required value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label={type === "sick" ? t("leaves.reason_required") : t("field.reason")} name="reason" full>
          <Textarea name="reason" rows={2} required={type === "sick"} placeholder={type === "sick" ? t("leaves.reason_sick_ph") : ""} />
        </Field>
      </div>
      <Notice>{t("leaves.days_preview", { n: days })} {t("leaves.type_rule_" + type)}</Notice>
    </FormModal>
  );
}

function DecideModal({ leave, approve, onClose, onDone }) {
  const i = useI18n();
  const { t } = i;
  return (
    <FormModal title={approve ? t("leaves.approve_title") : t("leaves.reject_title")} danger={!approve}
      submitLabel={approve ? t("leaves.approve") : t("leaves.reject")} onClose={onClose}
      submit={async (fd) => onDone(await api.post(`/leaves/${leave.id}/${approve ? "approve" : "reject"}/`, { comment: fd.get("comment") }))}>
      <p>{t("leaves.decide_text", { name: leave.employee_name, type: t("leave." + leave.type), start: i.date(leave.start_date), end: i.date(leave.end_date), n: leave.days })}</p>
      {leave.reason && <p className="muted">« {leave.reason} »</p>}
      <Field label={approve ? t("leaves.comment_optional") : t("leaves.comment_reject")}>
        <Textarea name="comment" rows={2} />
      </Field>
    </FormModal>
  );
}

export function LeaveRows({ rows, onDecide, onCancel, showEmployee = true }) {
  const i = useI18n();
  const { t } = i;
  const { today } = useAuth();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          {showEmployee && <th>{t("field.employee")}</th>}
          <th>{t("field.type")}</th><th>{t("leaves.period")}</th><th className="right">{t("leaves.days")}</th>
          <th className="hide-sm">{t("field.reason")}</th><th>{t("field.status")}</th><th />
        </tr></thead>
        <tbody>
          {rows.map((lv) => (
            <tr key={lv.id}>
              {showEmployee && <td><Link to={`/hr/employees/${lv.employee}`} style={{ color: "inherit" }}><Person name={lv.employee_name} sub={lv.service_name} /></Link></td>}
              <td>{t("leave." + lv.type)}</td>
              <td className="nowrap">{i.date(lv.start_date)} → {i.date(lv.end_date)}</td>
              <td className="num">{lv.days}</td>
              <td className="hide-sm small" style={{ maxWidth: 260 }}>
                {lv.reason || <span className="muted">—</span>}
                {lv.decision_comment && <div className="muted">{t("leaves.comment")} : {lv.decision_comment}</div>}
              </td>
              <td>
                <StatusBadge group="lstatus" value={lv.status} />
                {lv.decided_by_name && <div className="muted small nowrap">{lv.decided_by_name}</div>}
              </td>
              <td>
                <div className="actions">
                  {lv.status === "pending" && onDecide && <>
                    <button className="btn success sm" onClick={() => onDecide(lv, true)}><Check size={15} /><span className="hide-sm">{t("leaves.approve")}</span></button>
                    <button className="btn danger sm" onClick={() => onDecide(lv, false)}><X size={15} /><span className="hide-sm">{t("leaves.reject")}</span></button>
                  </>}
                  {onCancel && ((lv.status === "approved" && lv.start_date > today) || (lv.status === "pending" && !onDecide)) && (
                    <button className="btn ghost sm" onClick={() => onCancel(lv)} title={t("leaves.cancel")}><Undo2 size={15} /><span className="hide-sm">{t("leaves.cancel")}</span></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useLeaveActions(reload) {
  const i = useI18n();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [deciding, setDeciding] = useState(null);
  const cancel = async (lv) => {
    if (!(await confirm(i.t("leaves.cancel_confirm", { name: lv.employee_name }), { label: i.t("leaves.cancel") }))) return;
    try {
      await api.post(`/leaves/${lv.id}/cancel/`, {});
      toast(i.t("leaves.cancelled"));
      reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };
  const node = (
    <>
      {confirmNode}
      {deciding && <DecideModal leave={deciding.leave} approve={deciding.approve} onClose={() => setDeciding(null)} onDone={(lv) => {
        setDeciding(null);
        toast(i.t(lv.status === "approved" ? "leaves.approved_toast" : "leaves.rejected_toast", { name: lv.employee_name }));
        reload();
      }} />}
    </>
  );
  return { cancel, decide: (leave, approve) => setDeciding({ leave, approve }), node };
}

export default function Leaves() {
  const { t } = useI18n();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "pending";
  const [type, setType] = useState("");
  const [creating, setCreating] = useState(false);
  const list = useApi(() => api.get("/leaves/", { status, type }), [status, type]);
  const { cancel, decide, node } = useLeaveActions(list.reload);
  return (
    <>
      <div className="page-head">
        <div><h1>{t("leaves.title")}</h1><p>{t("leaves.sub")}</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><CalendarPlus size={16} />{t("leaves.new")}</button>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <div className="seg" role="group">
              {["pending", "approved", "rejected", "cancelled", ""].map((s) => (
                <button key={s} className={status === s ? "on" : ""} onClick={() => setParams({ status: s }, { replace: true })}>{s ? t("lstatus." + s) : t("common.all")}</button>
              ))}
            </div>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("field.type")}>
              <option value="">{t("leaves.all_types")}</option>
              {LEAVE_TYPES.map((k) => <option key={k} value={k}>{t("leave." + k)}</option>)}
            </select>
          </div>
          <span className="muted small">{list.data ? t("leaves.count", { n: list.data.length }) : ""}</span>
        </div>
        <Async q={list}>
          {(rows) => rows.length ? <LeaveRows rows={rows} onDecide={decide} onCancel={cancel} />
            : <Empty icon={CalendarDays}>{status === "pending" ? t("dash.no_pending") : t("leaves.none")}</Empty>}
        </Async>
      </div>
      {creating && <LeaveForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); toast(t("leaves.created")); list.reload(); }} />}
      {node}
    </>
  );
}
