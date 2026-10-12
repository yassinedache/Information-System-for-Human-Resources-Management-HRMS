import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, FileSignature, FileUp, Loader2, MapPin } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, ErrorBox, Field, Input, Textarea, useApi } from "../../ui.jsx";

const MAX_CV = 2 * 1024 * 1024;

/** a one-page PDF with the candidate's name, for trying the demo without a CV at hand */
function samplePdf(name) {
  const text = `CV - ${name || "Candidat"}`.replace(/[()\\]/g, "").normalize("NFD").replace(/[^\x20-\x7e]/g, "");
  const stream = `BT /F1 20 Tf 72 720 Td (${text}) Tj ET`;
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, k) => { offsets.push(out.length); out += `${k + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([out], "cv-exemple.pdf", { type: "application/pdf" });
}

function ApplyForm({ job }) {
  const i = useI18n();
  const { t } = i;
  const [cv, setCv] = useState(null);
  const [cvError, setCvError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const formRef = useRef(null);
  const fileRef = useRef(null);

  const pick = (f) => {
    setCvError("");
    if (!f) return setCv(null);
    if (!/\.pdf$/i.test(f.name) || (f.type && f.type !== "application/pdf")) { setCv(null); return setCvError(t("apply.cv_pdf")); }
    if (f.size > MAX_CV) { setCv(null); return setCvError(t("apply.cv_size")); }
    setCv(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!cv) return setCvError(t("apply.cv_required"));
    const fd = new FormData(e.currentTarget);
    fd.set("cv", cv, cv.name);
    setBusy(true);
    setError(null);
    try {
      await api.upload(`/public/jobs/${job.id}/apply/`, fd);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card pad stack" style={{ alignItems: "center", textAlign: "center" }}>
        <CheckCircle2 size={44} color="var(--success)" />
        <h2>{t("apply.done_title")}</h2>
        <p className="muted">{t("apply.done_text")}</p>
        <Link className="btn" to="/#jobs">{t("apply.other_jobs")}</Link>
      </div>
    );
  }
  const fe = i.fieldErrors(error);
  return (
    <form ref={formRef} className="card pad stack" onSubmit={submit}>
      <h2>{t("apply.title")}</h2>
      <div className="form-grid">
        <Field label={t("field.first_name")} error={fe.first_name}><Input name="first_name" required autoComplete="given-name" /></Field>
        <Field label={t("field.last_name")} error={fe.last_name}><Input name="last_name" required autoComplete="family-name" /></Field>
        <Field label={t("field.email")} full error={fe.email}><Input name="email" type="email" required autoComplete="email" /></Field>
        <Field label={t("field.phone")} full error={fe.phone}><Input name="phone" type="tel" autoComplete="tel" /></Field>
        <Field label={t("field.cover_letter")} full error={fe.cover_letter}><Textarea name="cover_letter" rows={4} /></Field>
      </div>
      <div className="field">
        <span>{t("field.cv")}</span>
        <div className={"file-drop" + (cv ? " has" : "")} onClick={() => fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
          <FileUp size={22} />
          <div>{cv ? <b>{cv.name}</b> : t("apply.cv_pick")}</div>
          <small>{t("apply.cv_rules")}</small>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files[0])} aria-label={t("field.cv")} />
        </div>
        {(cvError || fe.cv) && <small className="err">{cvError || fe.cv}</small>}
        {__DEMO__ && !cv && (
          <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => {
            const f = formRef.current;
            pick(samplePdf(`${f.first_name.value} ${f.last_name.value}`.trim()));
          }}>{t("apply.sample_cv")}</button>
        )}
      </div>
      {error && !Object.keys(fe).some((k) => ["first_name", "last_name", "email", "phone", "cover_letter", "cv"].includes(k)) && <ErrorBox error={error} />}
      <button className="btn primary lg" disabled={busy}>{busy && <Loader2 size={18} className="spin" />}{t("apply.send")}</button>
      <p className="muted small">{t("apply.privacy")}</p>
    </form>
  );
}

export default function JobPage() {
  const { id } = useParams();
  const i = useI18n();
  const job = useApi(() => api.get(`/public/jobs/${id}/`), [id]);
  return (
    <div className="wrap">
      <div style={{ paddingTop: 24 }}><Link to="/#jobs" className="btn ghost sm"><ArrowLeft size={16} />{i.t("jobs.back")}</Link></div>
      <Async q={job}>
        {(j) => (
          <div className="job-detail">
            <article className="card pad stack">
              <div className="row"><span className="badge blue">{i.t("contract." + j.contract_type)}</span></div>
              <h1>{j.title}</h1>
              <div className="row muted small" style={{ gap: 18 }}>
                {j.service_name && <span className="row" style={{ gap: 5 }}><Building2 size={15} />{j.service_name}</span>}
                {j.location && <span className="row" style={{ gap: 5 }}><MapPin size={15} />{j.location}</span>}
                <span className="row" style={{ gap: 5 }}><CalendarDays size={15} />{i.t("jobs.until", { date: i.date(j.deadline) })}</span>
                <span className="row" style={{ gap: 5 }}><FileSignature size={15} />{i.t("contract." + j.contract_type + "_long")}</span>
              </div>
              <h3>{i.t("jobs.mission")}</h3>
              <p className="prose">{j.description}</p>
              {j.requirements && <><h3>{i.t("jobs.profile")}</h3><p className="prose">{j.requirements}</p></>}
            </article>
            <ApplyForm job={j} />
          </div>
        )}
      </Async>
    </div>
  );
}
