import { Link } from "react-router-dom";
import { Briefcase, CalendarDays, Check, Clock, FileSignature, Plane, UserPlus, Users, Wallet, X } from "lucide-react";
import { api } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { BarChart, DoughnutChart, LineChart } from "../../charts.jsx";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, Person, Stat, StatusBadge, useApi, useToast } from "../../ui.jsx";

export default function Dashboard() {
  const i = useI18n();
  const { t } = i;
  const { user } = useAuth();
  const toast = useToast();
  const q = useApi(() => api.get("/dashboard/"));

  const decide = async (lv, approve) => {
    try {
      await api.post(`/leaves/${lv.id}/${approve ? "approve" : "reject"}/`, {});
      toast(approve ? t("leaves.approved_toast", { name: lv.employee_name }) : t("leaves.rejected_toast", { name: lv.employee_name }));
      q.reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t("dash.hello", { name: user.first_name })}</h1>
          <p>{i.day(q.data ? q.data.today : null)}</p>
        </div>
        <div className="row">
          <Link className="btn" to="/hr/employees?new=1"><UserPlus size={16} />{t("employees.new")}</Link>
          <Link className="btn primary" to="/hr/payroll"><Wallet size={16} />{t("nav.payroll")}</Link>
        </div>
      </div>
      <Async q={q}>
        {(d) => {
          const att = d.attendance_today;
          return (
            <>
              <div className="grid stats">
                <Stat icon={Users} label={t("dash.employees")} value={d.employees} sub={t("dash.services_n", { n: d.services })} to="/hr/employees" />
                <Stat icon={Plane} tone="green" label={t("dash.on_leave")} value={d.on_leave} sub={t("dash.today")} to="/hr/leaves?status=approved" />
                <Stat icon={CalendarDays} tone="orange" label={t("dash.pending")} value={d.pending_leaves} sub={t("dash.to_process")} to="/hr/leaves" />
                <Stat icon={FileSignature} label={t("dash.contracts")} value={d.active_contracts}
                  sub={t("dash.ending_n", { n: d.contracts_ending.length })} to="/hr/contracts" />
                <Stat icon={Briefcase} tone="green" label={t("dash.offers")} value={d.open_offers}
                  sub={t("dash.new_apps", { n: d.new_applications })} to="/hr/recruitment" />
                <Stat icon={Wallet} tone="orange" label={t("dash.payroll")} value={d.payroll ? i.money(d.payroll.total_net) : "—"}
                  sub={d.payroll ? t("dash.payroll_sub", { month: i.month(d.payroll.period), n: d.payroll.count }) : ""} to="/hr/payroll" />
              </div>

              <div className="grid two">
                <div className="card">
                  <div className="card-head"><h3>{t("dash.pending_title")}</h3><Link to="/hr/leaves" className="small">{t("common.see_all")}</Link></div>
                  {d.pending_list.length ? (
                    <div className="list">
                      {d.pending_list.map((lv) => (
                        <div key={lv.id} className="list-item">
                          <Person name={lv.employee_name} sub={`${t("leave." + lv.type)} · ${i.date(lv.start_date)} → ${i.date(lv.end_date)} · ${t("common.days_n", { n: lv.days })}`} />
                          <div className="row" style={{ flexWrap: "nowrap" }}>
                            <button className="btn success sm icon" title={t("leaves.approve")} aria-label={t("leaves.approve")} onClick={() => decide(lv, true)}><Check size={16} /></button>
                            <button className="btn danger sm icon" title={t("leaves.reject")} aria-label={t("leaves.reject")} onClick={() => decide(lv, false)}><X size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <Empty icon={Check}>{t("dash.no_pending")}</Empty>}
                </div>

                <div className="card">
                  <div className="card-head">
                    <h3>{t("dash.attendance_title")}</h3>
                    <Link to="/hr/attendance" className="small">{t("common.see_all")}</Link>
                  </div>
                  <div className="card-body">
                    {att.working_day ? (
                      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                        {["present", "absent", "on_leave", "not_recorded"].map((k) => (
                          <div key={k} className="mini-stat" style={{ justifyContent: "space-between" }}>
                            <StatusBadge group="att" value={k} />
                            <b style={{ fontSize: "1.3rem" }}>{att[k] || 0}</b>
                          </div>
                        ))}
                      </div>
                    ) : <Empty icon={Clock}>{t("dash.weekend")}</Empty>}
                  </div>
                  <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}><h3>{t("dash.ending_title")}</h3></div>
                  {d.contracts_ending.length ? (
                    <div className="list">
                      {d.contracts_ending.map((c) => (
                        <Link key={c.id} to={`/hr/employees/${c.employee}`} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
                          <Person name={c.employee_name} sub={t("contract." + c.type)} />
                          <span className="badge orange">{i.date(c.end_date)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : <Empty>{t("dash.no_ending")}</Empty>}
                </div>
              </div>

              <div className="grid two">
                <div className="card">
                  <div className="card-head"><h3>{t("dash.headcount")}</h3></div>
                  <div className="card-body chart-box">
                    <BarChart horizontal labels={d.headcount_by_service.map((s) => s.name)} data={d.headcount_by_service.map((s) => s.n)} label={t("dash.employees")} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><h3>{t("dash.hires")}</h3></div>
                  <div className="card-body chart-box">
                    <LineChart labels={d.hires_by_month.map((m) => i.shortMonth(m.month + "-01"))} data={d.hires_by_month.map((m) => m.n)} label={t("dash.hires")} />
                  </div>
                </div>
              </div>

              <div className="grid two">
                <div className="card">
                  <div className="card-head"><h3>{t("dash.contract_types")}</h3></div>
                  <div className="card-body chart-box small">
                    <DoughnutChart labels={Object.keys(d.contracts_by_type).map((k) => t("contract." + k))} data={Object.values(d.contracts_by_type)} />
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><h3>{t("dash.leave_days")}</h3></div>
                  <div className="card-body chart-box small">
                    {Object.keys(d.leaves_by_type).length ? (
                      <DoughnutChart labels={Object.keys(d.leaves_by_type).map((k) => t("leave." + k))} data={Object.values(d.leaves_by_type)} />
                    ) : <Empty>{t("common.none")}</Empty>}
                  </div>
                </div>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
