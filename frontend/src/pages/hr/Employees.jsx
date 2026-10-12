import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, UserPlus, Users } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import {
  Async, Empty, Field, FormModal, Input, PasswordReveal, Person, Select, StatusBadge, Textarea, formObject, useApi, useToast,
} from "../../ui.jsx";

/** Create or edit an employee. On creation, a login is created too (temporary password shown once). */
export function EmployeeForm({ employee, onClose, onSaved }) {
  const i = useI18n();
  const { t } = i;
  const { today } = useAuth();
  const services = useApi(() => api.get("/services/"));
  const editing = !!employee;
  const e = employee || {};
  return (
    <FormModal wide title={editing ? t("employees.edit") : t("employees.new")} onClose={onClose}
      submitLabel={editing ? t("common.save") : t("employees.create")}
      submit={async (fd) => {
        const data = formObject(fd, ["birth_date"]);
        if (!editing) data.create_account = fd.get("create_account") === "on";
        const saved = editing ? await api.patch(`/employees/${e.id}/`, data) : await api.post("/employees/", data);
        onSaved(saved);
      }}>
      <div className="form-grid">
        <Field label={t("field.first_name")} name="first_name"><Input name="first_name" required defaultValue={e.first_name} /></Field>
        <Field label={t("field.last_name")} name="last_name"><Input name="last_name" required defaultValue={e.last_name} /></Field>
        <Field label={t("field.email")} name="email"><Input name="email" type="email" required defaultValue={e.email} /></Field>
        <Field label={t("field.phone")} name="phone"><Input name="phone" type="tel" defaultValue={e.phone} /></Field>
        <Field label={t("field.service")} name="service">
          <Select name="service" required defaultValue={e.service || ""} placeholder={t("common.choose")}
            options={(services.data || []).map((s) => [s.id, s.name])} />
        </Field>
        <Field label={t("field.position")} name="position"><Input name="position" defaultValue={e.position} /></Field>
        <Field label={t("field.hire_date")} name="hire_date"><Input name="hire_date" type="date" required defaultValue={e.hire_date || today} /></Field>
        <Field label={t("field.birth_date")} name="birth_date"><Input name="birth_date" type="date" max={today} defaultValue={e.birth_date || ""} /></Field>
        <Field label={t("field.address")} name="address" full><Textarea name="address" rows={2} defaultValue={e.address} /></Field>
        <Field label={t("field.skills")} name="skills" full hint={t("employees.skills_hint")}><Input name="skills" defaultValue={e.skills} /></Field>
        {!editing && (
          <label className="check full"><input type="checkbox" name="create_account" defaultChecked /> {t("employees.create_account")}</label>
        )}
      </div>
    </FormModal>
  );
}

export default function Employees() {
  const i = useI18n();
  const { t } = i;
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [service, setService] = useState(params.get("service") || "");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [reveal, setReveal] = useState(null);
  useEffect(() => { const h = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(h); }, [q]);
  const services = useApi(() => api.get("/services/"));
  const list = useApi(() => api.get("/employees/", { q: debounced, service, status }), [debounced, service, status]);

  const closeCreate = () => { setCreating(false); if (params.get("new")) setParams({}, { replace: true }); };

  return (
    <>
      <div className="page-head">
        <div><h1>{t("employees.title")}</h1><p>{t("employees.sub")}</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><UserPlus size={16} />{t("employees.new")}</button>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="toolbar" style={{ flex: 1 }}>
            <div className="search">
              <Search size={16} />
              <input className="input" placeholder={t("employees.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("employees.search")} />
            </div>
            <select className="input" value={service} onChange={(e) => setService(e.target.value)} aria-label={t("field.service")}>
              <option value="">{t("employees.all_services")}</option>
              {(services.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="seg" role="group">
              {[["active", t("employees.f_active")], ["inactive", t("employees.f_inactive")], ["", t("common.all")]].map(([v, l]) => (
                <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)}>{l}</button>
              ))}
            </div>
          </div>
          <span className="muted small">{list.data ? t("employees.count", { n: list.data.length }) : ""}</span>
        </div>
        <Async q={list}>
          {(rows) => rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>
                  <th>{t("field.employee")}</th><th>{t("field.service")}</th><th className="hide-sm">{t("field.position")}</th>
                  <th className="hide-sm">{t("field.contract")}</th><th className="hide-sm">{t("field.hire_date")}</th><th>{t("field.state")}</th>
                </tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="click" onClick={() => navigate(`/hr/employees/${e.id}`)} tabIndex={0}
                      onKeyDown={(ev) => { if (ev.key === "Enter") navigate(`/hr/employees/${e.id}`); }}>
                      <td><Person first={e.first_name} last={e.last_name} sub={e.email} /></td>
                      <td>{e.service_name}</td>
                      <td className="hide-sm">{e.position || "—"}</td>
                      <td className="hide-sm">{e.contract ? <span className="badge blue">{t("contract." + e.contract.type)}</span> : <span className="badge">{t("employees.no_contract")}</span>}</td>
                      <td className="hide-sm nowrap">{i.date(e.hire_date)}</td>
                      <td><StatusBadge group="emp" value={e.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={Users}>{t("employees.none")}</Empty>}
        </Async>
      </div>
      {creating && (
        <EmployeeForm onClose={closeCreate} onSaved={(emp) => {
          closeCreate();
          toast(t("employees.created", { name: `${emp.first_name} ${emp.last_name}` }));
          list.reload();
          if (emp.temporary_password) setReveal(emp);
          else navigate(`/hr/employees/${emp.id}`);
        }} />
      )}
      {reveal && (
        <PasswordReveal name={`${reveal.first_name} ${reveal.last_name} (${reveal.email})`} password={reveal.temporary_password}
          onClose={() => { const id = reveal.id; setReveal(null); navigate(`/hr/employees/${id}`); }} />
      )}
    </>
  );
}
