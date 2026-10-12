import { useState } from "react";
import { Link } from "react-router-dom";
import { Archive, FilePlus2, FileSignature, Pencil } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import {
  Async, Empty, Field, FormModal, Input, Notice, Select, StatusBadge, Textarea, formObject, useApi, useConfirm, useToast,
} from "../../ui.jsx";

export const CONTRACT_TYPES = ["CDI", "CDD", "STAGE", "INTERIM"];

/** Create or edit a contract. The backend refuses overlapping contracts (one active contract at a time). */
export function ContractForm({ contract, employeeId, onClose, onSaved }) {
  const { t } = useI18n();
  const { today } = useAuth();
  const editing = !!contract;
  const c = contract || {};
  const [type, setType] = useState(c.type || "CDI");
  const employees = useApi(() => (employeeId || editing ? Promise.resolve([]) : api.get("/employees/", { status: "active" })));
  return (
    <FormModal title={editing ? t("contracts.edit") : t("contracts.new")} onClose={onClose}
      submit={async (fd) => {
        const data = formObject(fd, ["end_date"]);
        if (employeeId) data.employee = employeeId;
        if (editing) data.employee = c.employee;
        onSaved(editing ? await api.patch(`/contracts/${c.id}/`, data) : await api.post("/contracts/", data));
      }}>
      <div className="form-grid">
        {!employeeId && !editing && (
          <Field label={t("field.employee")} name="employee" full>
            <Select name="employee" required placeholder={t("common.choose")} defaultValue=""
              options={(employees.data || []).map((e) => [e.id, `${e.last_name} ${e.first_name}${e.contract ? " · " + t("contract." + e.contract.type) : ""}`])} />
          </Field>
        )}
        <Field label={t("field.type")} name="type">
          <Select name="type" value={type} onChange={(e) => setType(e.target.value)} options={CONTRACT_TYPES.map((k) => [k, t("contract." + k + "_long")])} />
        </Field>
        <Field label={t("field.monthly_salary")} name="monthly_salary">
          <Input name="monthly_salary" type="number" min="0" step="100" required defaultValue={c.monthly_salary} />
        </Field>
        <Field label={t("field.start_date")} name="start_date"><Input name="start_date" type="date" required defaultValue={c.start_date || today} /></Field>
        <Field label={t("field.end_date")} name="end_date" hint={type === "CDI" ? t("contracts.cdi_hint") : t("contracts.end_required")}>
          <Input name="end_date" type="date" required={type !== "CDI"} defaultValue={c.end_date || ""} />
        </Field>
        <Field label={t("field.notes")} name="notes" full><Textarea name="notes" rows={2} defaultValue={c.notes} /></Field>
      </div>
      <Notice>{t("contracts.rule")}</Notice>
    </FormModal>
  );
}

export function ContractRows({ rows, onEdit, onArchive, showEmployee = true }) {
  const i = useI18n();
  const { t } = i;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          {showEmployee && <th>{t("field.employee")}</th>}
          <th>{t("field.type")}</th><th>{t("field.start_date")}</th><th>{t("field.end_date")}</th>
          <th className="right">{t("field.monthly_salary")}</th><th className="right hide-sm">{t("field.daily_salary")}</th>
          <th>{t("field.state")}</th><th />
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              {showEmployee && <td><Link to={`/hr/employees/${c.employee}`}><b>{c.employee_name}</b></Link></td>}
              <td><span className="badge blue">{t("contract." + c.type)}</span></td>
              <td className="nowrap">{i.date(c.start_date)}</td>
              <td className="nowrap">{c.end_date ? i.date(c.end_date) : <span className="muted">{t("contracts.open_ended")}</span>}</td>
              <td className="num">{i.amount(c.monthly_salary)}</td>
              <td className="num hide-sm">{i.amount(c.daily_salary)}</td>
              <td><StatusBadge group="cstate" value={c.state} /></td>
              <td>
                {c.state !== "archived" && (
                  <div className="actions">
                    <button className="btn ghost sm icon" title={t("common.edit")} aria-label={t("common.edit")} onClick={() => onEdit(c)}><Pencil size={15} /></button>
                    <button className="btn ghost sm icon" title={t("contracts.archive")} aria-label={t("contracts.archive")} onClick={() => onArchive(c)}><Archive size={15} /></button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useContractActions(reload) {
  const i = useI18n();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const archive = async (c) => {
    if (!(await confirm(i.t("contracts.archive_confirm", { name: c.employee_name }), { label: i.t("contracts.archive") }))) return;
    try {
      await api.post(`/contracts/${c.id}/archive/`, {});
      toast(i.t("contracts.archived"));
      reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };
  return { archive, confirmNode };
}

export default function Contracts() {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState("active");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState(null);
  const list = useApi(() => api.get("/contracts/", { state, type }), [state, type]);
  const { archive, confirmNode } = useContractActions(list.reload);
  return (
    <>
      <div className="page-head">
        <div><h1>{t("contracts.title")}</h1><p>{t("contracts.sub")}</p></div>
        <button className="btn primary" onClick={() => setEditing({})}><FilePlus2 size={16} />{t("contracts.new")}</button>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <div className="seg" role="group">
              {["active", "upcoming", "ended", "archived", ""].map((s) => (
                <button key={s} className={state === s ? "on" : ""} onClick={() => setState(s)}>{s ? t("cstate." + s) : t("common.all")}</button>
              ))}
            </div>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("field.type")}>
              <option value="">{t("contracts.all_types")}</option>
              {CONTRACT_TYPES.map((k) => <option key={k} value={k}>{t("contract." + k + "_long")}</option>)}
            </select>
          </div>
          <span className="muted small">{list.data ? t("contracts.count", { n: list.data.length }) : ""}</span>
        </div>
        <Async q={list}>
          {(rows) => rows.length ? <ContractRows rows={rows} onEdit={setEditing} onArchive={archive} />
            : <Empty icon={FileSignature}>{t("contracts.none")}</Empty>}
        </Async>
      </div>
      {editing && (
        <ContractForm contract={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => {
          setEditing(null);
          toast(t("contracts.saved"));
          list.reload();
        }} />
      )}
      {confirmNode}
    </>
  );
}
