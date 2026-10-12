import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight, Briefcase, Building2, CalendarClock, CalendarDays, Clock, FileSignature, LayoutDashboard, MapPin,
  ShieldCheck, Users, Wallet,
} from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, useApi } from "../../ui.jsx";

const FEATURES = [
  ["employees", Users], ["leaves", CalendarDays], ["contracts", FileSignature], ["payroll", Wallet],
  ["attendance", Clock], ["recruitment", Briefcase], ["dashboard", LayoutDashboard], ["security", ShieldCheck],
];

export function JobCard({ job }) {
  const i = useI18n();
  return (
    <Link className="card job" to={`/jobs/${job.id}`}>
      <div className="row between">
        <span className="badge blue">{i.t("contract." + job.contract_type)}</span>
        <span className="muted small">{i.t("jobs.until", { date: i.date(job.deadline) })}</span>
      </div>
      <h3>{job.title}</h3>
      <div className="meta">
        {job.service_name && <span><Building2 size={14} />{job.service_name}</span>}
        {job.location && <span><MapPin size={14} />{job.location}</span>}
      </div>
      <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{job.description}</p>
      <span className="row small" style={{ color: "var(--primary)", fontWeight: 600 }}>{i.t("jobs.see")} <ArrowRight size={15} /></span>
    </Link>
  );
}

export default function Landing() {
  const i = useI18n();
  const { t } = i;
  const { user } = useAuth();
  const loc = useLocation();
  const jobs = useApi(() => api.get("/public/jobs/"));

  useEffect(() => {
    if (loc.hash === "#jobs") document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" });
  }, [loc.hash, jobs.data]);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="badge blue" style={{ marginBottom: 14 }}>{t("landing.kicker")}</span>
            <h1>{t("landing.title_a")} <em>{t("landing.title_b")}</em></h1>
            <p className="lead">{t("landing.lead")}</p>
            <div className="row">
              <a className="btn primary lg" href="#jobs" onClick={(e) => { e.preventDefault(); document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" }); }}>
                <Briefcase size={18} />{t("landing.cta_jobs")}
              </a>
              <Link className="btn lg" to={user ? (user.role === "hr" ? "/hr" : "/me") : "/login"}>
                {user ? t("nav.my_space") : t("landing.cta_login")}<ArrowRight size={18} />
              </Link>
            </div>
          </div>
          <div className="card hero-card" aria-hidden="true">
            <div className="mini-stat"><span className="ico"><Users size={20} /></span>
              <div><b>{t("landing.m1")}</b><div className="muted small">{t("landing.m1s")}</div></div></div>
            <div className="mini-stat"><span className="ico green"><CalendarClock size={20} /></span>
              <div><b>{t("landing.m2")}</b><div className="muted small">{t("landing.m2s")}</div></div></div>
            <div className="mini-stat"><span className="ico orange"><Wallet size={20} /></span>
              <div><b>{t("landing.m3")}</b><div className="muted small">{t("landing.m3s")}</div></div></div>
          </div>
        </div>
      </section>

      <section className="section" id="jobs">
        <div className="wrap">
          <h2>{t("landing.jobs_title")}</h2>
          <p className="sub">{t("landing.jobs_sub")}</p>
          <Async q={jobs}>
            {(list) => list.length ? (
              <div className="jobs">{list.map((j) => <JobCard key={j.id} job={j} />)}</div>
            ) : <div className="card"><Empty icon={Briefcase}>{t("landing.no_jobs")}</Empty></div>}
          </Async>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="wrap">
          <h2>{t("landing.features_title")}</h2>
          <p className="sub">{t("landing.features_sub")}</p>
          <div className="features">
            {FEATURES.map(([k, Icon]) => (
              <div key={k} className="card feature">
                <span className="ico"><Icon size={21} /></span>
                <h3>{t(`feature.${k}`)}</h3>
                <p>{t(`feature.${k}_text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
