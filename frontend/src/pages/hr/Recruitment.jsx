import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, CalendarDays, ExternalLink, FileText, Inbox, MapPin, Pencil, Plus, UserCheck, Users } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { addDays, useI18n } from "../../i18n.jsx";
import {
  Async, Empty, Field, FormModal, Input, Modal, Notice, PasswordReveal, Person, Select, StatusBadge, Textarea, formObject,
  useApi, useToast,
} from "../../ui.jsx";
import { CONTRACT_TYPES } from "./Contracts.jsx";

const APP_STATUSES = ["received", "shortlisted", "interview", "rejected", "hired"];

function OfferForm({ offer, onClose, onSaved }) {
  const { t } = useI18n();
  const { today } = useAuth();
  const services = useApi(() => api.get("/services/"));
  const o = offer || {};
  return (
    <FormModal wide title={offer ? t("rec.edit_offer") : t("rec.new_offer")} onClose={onClose}
      submit={async (fd) => {
        const data = formObject(fd, ["service"]);
        onSaved(offer ? await api.patch(`/jobs/${o.id}/`, data) : await api.post("/jobs/", data));
      }}>
      <div className="form-grid">
        <Field label={t("field.title")} name="title" full><Input name="title" required defaultValue={o.title} /></Field>
        <Field label={t("field.service")} name="service">
          <Select name="service" defaultValue={o.service || ""} placeholder={t("common.none")} options={(services.data || []).map((s) => [s.id, s.name])} />
        </Field>
        <Field label={t("field.contract")} name="contract_type">
          <Select name="contract_type" defaultValue={o.contract_type || "CDI"} options={CONTRACT_TYPES.map((k) => [k, t("contract." + k + "_long")])} />
        </Field>
        <Field label={t("field.location")} name="location"><Input name="location" defaultValue={o.location} /></Field>
        <Field label={t("field.deadline")} name="deadline"><Input name="deadline" type="date" required defaultValue={o.deadline || addDays(today, 30)} /></Field>
        <Field label={t("field.description")} name="description" full><Textarea name="description" rows={4} required defaultValue={o.description} /></Field>
        <Field label={t("field.requirements")} name="requirements" full><Textarea name="requirements" rows={3} defaultValue={o.requirements} /></Field>
        <Field label={t("field.status")} name="status">
          <Select name="status" defaultValue={o.status || "open"} options={[["open", t("ostatus.open")], ["closed", t("ostatus.closed")]]} />
        </Field>
      </div>
    </FormModal>
  );
}

function Offers({ onShowApplications }) {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const list = useApi(() => api.get("/jobs/"));
  return (
    <>
      <div className="row between">
        <span className="muted">{t("rec.offers_sub")}</span>
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={16} />{t("rec.new_offer")}</button>
      </div>
      <Async q={list}>
        {(offers) => offers.length ? (
          <div className="jobs">
            {offers.map((o) => (
              <div key={o.id} className="card job">
                <div className="row between">
                  <span className="badge blue">{t("contract." + o.contract_type)}</span>
                  <StatusBadge group="ostatus" value={o.is_open ? "open" : "closed"} />
                </div>
                <h3>{o.title}</h3>
                <div className="meta">
                  {o.service_name && <span><Users size={14} />{o.service_name}</span>}
                  {o.location && <span><MapPin size={14} />{o.location}</span>}
                  <span><CalendarDays size={14} />{i.date(o.deadline)}</span>
                </div>
                <div className="row between" style={{ marginTop: "auto" }}>
                  <button className="btn sm" onClick={() => onShowApplications(o.id)}><Inbox size={15} />{t("rec.apps_n", { n: o.applications_count })}</button>
                  <div className="row">
                    {o.is_open && <Link className="btn ghost sm icon" to={`/jobs/${o.id}`} title={t("rec.public_page")} aria-label={t("rec.public_page")}><ExternalLink size={15} /></Link>}
                    <button className="btn ghost sm icon" onClick={() => setEditing(o)} title={t("common.edit")} aria-label={t("common.edit")}><Pencil size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="card"><Empty icon={Briefcase}>{t("rec.no_offers")}</Empty></div>}
      </Async>
      {editing && <OfferForm offer={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast(t("rec.offer_saved")); list.reload(); }} />}
    </>
  );
}

function HireForm({ app, onClose, onDone }) {
  const { t } = useI18n();
  const { today } = useAuth();
  const services = useApi(() => api.get("/services/"));
  const offer = useApi(() => api.get(`/jobs/${app.offer}/`));
  const [type, setType] = useState(null);
  const ctype = type || (offer.data && offer.data.contract_type) || "CDI";
  if (!offer.data) return null;
  return (
    <FormModal title={t("rec.hire_title", { name: `${app.first_name} ${app.last_name}` })} submitLabel={t("rec.hire")} onClose={onClose}
      submit={async (fd) => onDone(await api.post(`/applications/${app.id}/hire/`, formObject(fd, ["end_date"])))}>
      <Notice>{t("rec.hire_text")}</Notice>
      <div className="form-grid">
        <Field label={t("field.service")} name="service">
          <Select name="service" required defaultValue={offer.data.service || ""} placeholder={t("common.choose")} options={(services.data || []).map((s) => [s.id, s.name])} />
        </Field>
        <Field label={t("field.start_date")} name="start_date"><Input name="start_date" type="date" required defaultValue={addDays(today, 14)} /></Field>
        <Field label={t("field.contract")} name="contract_type">
          <Select name="contract_type" value={ctype} onChange={(e) => setType(e.target.value)} options={CONTRACT_TYPES.map((k) => [k, t("contract." + k + "_long")])} />
        </Field>
        <Field label={t("field.monthly_salary")} name="monthly_salary"><Input name="monthly_salary" type="number" min="0" step="100" required /></Field>
        {ctype !== "CDI" && <Field label={t("field.end_date")} name="end_date"><Input name="end_date" type="date" required /></Field>}
      </div>
    </FormModal>
  );
}

function ApplicationModal({ app, onClose, onChanged }) {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const navigate = useNavigate();
  const [hiring, setHiring] = useState(false);
  const [hired, setHired] = useState(null);
  const [busy, setBusy] = useState(false);
  const openCv = async () => {
    try {
      const blob = await api.blob(`/applications/${app.id}/cv/`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast(i.error(err), "error");
    }
  };
  if (hired) {
    return <PasswordReveal name={`${app.first_name} ${app.last_name}`} password={hired.temporary_password}
      onClose={() => { onChanged(); navigate(`/hr/employees/${hired.employee}`); }} />;
  }
  if (hiring) return <HireForm app={app} onClose={() => setHiring(false)} onDone={(r) => { toast(t("rec.hired", { name: app.first_name })); setHired(r); }} />;
  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const data = formObject(fd, ["interview_at"]);
      await api.patch(`/applications/${app.id}/`, data);
      toast(t("rec.app_saved"));
      onChanged();
      onClose();
    } catch (err) {
      toast(i.error(err), "error");
    } finally {
      setBusy(false);
    }
  };
  const local = app.interview_at ? new Date(app.interview_at) : null;
  const pad = (n) => String(n).padStart(2, "0");
  const localValue = local ? `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}` : "";
  return (
    <Modal wide title={`${app.first_name} ${app.last_name}`} onClose={onClose}>
      <div className="row between">
        <div className="muted">{app.offer_title} · {i.date(app.created_at)}</div>
        <StatusBadge group="astatus" value={app.status} />
      </div>
      <dl className="kv">
        <dt>{t("field.email")}</dt><dd><a href={`mailto:${app.email}`}>{app.email}</a></dd>
        <dt>{t("field.phone")}</dt><dd>{app.phone || "—"}</dd>
        <dt>{t("field.cv")}</dt><dd>{app.has_cv ? <button className="btn sm" onClick={openCv}><FileText size={15} />{t("rec.open_cv")}</button> : "—"}</dd>
      </dl>
      {app.cover_letter && <div><h3 style={{ marginBottom: 6 }}>{t("field.cover_letter")}</h3><p className="prose muted">{app.cover_letter}</p></div>}
      {app.status === "hired" ? (
        <Notice kind="success">{t("rec.already_hired")} {app.employee && <Link to={`/hr/employees/${app.employee}`}>{t("rec.see_employee")}</Link>}</Notice>
      ) : (
        <form className="stack" onSubmit={save}>
          <div className="form-grid">
            <Field label={t("field.status")}>
              <Select name="status" defaultValue={app.status} options={APP_STATUSES.filter((s) => s !== "hired").map((s) => [s, t("astatus." + s)])} />
            </Field>
            <Field label={t("rec.interview_at")}><Input name="interview_at" type="datetime-local" defaultValue={localValue} /></Field>
            <Field label={t("field.hr_notes")} full><Textarea name="hr_notes" rows={3} defaultValue={app.hr_notes} /></Field>
          </div>
          <div className="row between">
            <button type="button" className="btn success" onClick={() => setHiring(true)}><UserCheck size={16} />{t("rec.hire")}</button>
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>{t("common.cancel")}</button>
              <button className="btn primary" disabled={busy}>{t("common.save")}</button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Applications({ offer, setOffer }) {
  const i = useI18n();
  const { t } = i;
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null);
  const offers = useApi(() => api.get("/jobs/"));
  const list = useApi(() => api.get("/applications/", { offer, status }), [offer, status]);
  return (
    <div className="card">
      <div className="card-head">
        <div className="toolbar">
          <select className="input" value={offer} onChange={(e) => setOffer(e.target.value)} aria-label={t("rec.offer")}>
            <option value="">{t("rec.all_offers")}</option>
            {(offers.data || []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("field.status")}>
            <option value="">{t("rec.all_statuses")}</option>
            {APP_STATUSES.map((s) => <option key={s} value={s}>{t("astatus." + s)}</option>)}
          </select>
        </div>
        <span className="muted small">{list.data ? t("rec.apps_n", { n: list.data.length }) : ""}</span>
      </div>
      <Async q={list}>
        {(rows) => rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("rec.candidate")}</th><th className="hide-sm">{t("rec.offer")}</th><th className="hide-sm">{t("rec.received_on")}</th><th>{t("field.status")}</th><th className="hide-sm">{t("rec.interview_at")}</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="click" onClick={() => setOpen(a)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpen(a); }}>
                    <td><Person first={a.first_name} last={a.last_name} sub={a.email} /></td>
                    <td className="hide-sm">{a.offer_title}</td>
                    <td className="hide-sm nowrap">{i.date(a.created_at)}</td>
                    <td><StatusBadge group="astatus" value={a.status} /></td>
                    <td className="hide-sm nowrap">{a.interview_at ? i.datetime(a.interview_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={Inbox}>{t("rec.no_apps")}</Empty>}
      </Async>
      {open && <ApplicationModal app={open} onClose={() => setOpen(null)} onChanged={() => { list.reload(); offers.reload(); }} />}
    </div>
  );
}

export default function Recruitment() {
  const { t } = useI18n();
  const [tab, setTab] = useState("applications");
  const [offer, setOffer] = useState("");
  return (
    <>
      <div className="page-head"><div><h1>{t("rec.title")}</h1><p>{t("rec.sub")}</p></div></div>
      <div className="tabs" role="tablist">
        <button className={tab === "applications" ? "on" : ""} onClick={() => setTab("applications")} role="tab"><Inbox size={16} />{t("rec.tab_apps")}</button>
        <button className={tab === "offers" ? "on" : ""} onClick={() => setTab("offers")} role="tab"><Briefcase size={16} />{t("rec.tab_offers")}</button>
      </div>
      {tab === "offers" ? <Offers onShowApplications={(id) => { setOffer(String(id)); setTab("applications"); }} /> : <Applications offer={offer} setOffer={setOffer} />}
    </>
  );
}
