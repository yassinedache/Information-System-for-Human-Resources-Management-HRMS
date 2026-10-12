/* Printable payslip (bulletin de paie), shared by HR payroll and the employee portal. */
import { Printer } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { Modal } from "../ui.jsx";

export function PayslipDoc({ p }) {
  const i = useI18n();
  const { t } = i;
  const cur = p.currency || "DZD";
  const m = (x) => i.money(x, cur);
  const rate = Math.round((p.social_security_rate || 0.09) * 1000) / 10;
  return (
    <div className="payslip">
      <header>
        <div>
          <h2>{t("slip.title")}</h2>
          <div>{t("slip.period", { month: i.month(p.period) })}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <b>{t("slip.company")}</b>
          <div style={{ color: "#6b7280" }}>{t("slip.company_sub")}</div>
        </div>
      </header>
      <div className="two">
        <div><span>{t("field.employee")}</span><b>{p.employee_name}</b></div>
        <div><span>{t("field.service")}</span><b>{p.service_name}</b></div>
        <div><span>{t("field.position")}</span><b>{p.position || "—"}</b></div>
        <div><span>{t("field.hire_date")}</span><b>{i.date(p.hire_date)}</b></div>
        <div><span>{t("field.contract")}</span><b>{p.contract_type ? t("contract." + p.contract_type) : "—"}</b></div>
        <div><span>{t("slip.days_paid")}</span><b>{p.prorata_days}</b></div>
      </div>
      <table>
        <thead><tr><th>{t("slip.line")}</th><th className="n">{t("slip.base")}</th><th className="n">{t("slip.gain")}</th><th className="n">{t("slip.deduction")}</th></tr></thead>
        <tbody>
          <tr><td>{t("slip.base_salary")}</td><td className="n">{t("common.days_n", { n: p.prorata_days })}</td><td className="n">{m(p.base_salary)}</td><td /></tr>
          {Number(p.bonus) > 0 && <tr><td>{t("slip.bonus")}</td><td /><td className="n">{m(p.bonus)}</td><td /></tr>}
          {p.absence_days + p.unpaid_leave_days > 0 && (
            <tr>
              <td>{t("slip.absences")}{p.unpaid_leave_days ? ` (${t("slip.absences_detail", { a: p.absence_days, u: p.unpaid_leave_days })})` : ""}</td>
              <td className="n">{t("common.days_n", { n: p.absence_days + p.unpaid_leave_days })}</td><td /><td className="n">{m(p.absence_deduction)}</td>
            </tr>
          )}
          <tr className="sub"><td>{t("slip.gross")}</td><td /><td className="n">{m(p.gross)}</td><td /></tr>
          <tr><td>{t("slip.social")}</td><td className="n">{rate} %</td><td /><td className="n">{m(p.social_security)}</td></tr>
          {Number(p.advance) > 0 && <tr><td>{t("slip.advance")}</td><td /><td /><td className="n">{m(p.advance)}</td></tr>}
          <tr className="total"><td>{t("slip.net")}</td><td /><td className="n" colSpan={2}>{m(p.net)}</td></tr>
        </tbody>
      </table>
      <footer>
        <span>{p.status === "validated" ? t("slip.validated_on", { date: i.date(p.validated_at) }) : t("slip.draft")}</span>
        <span>{t("slip.rule")}</span>
      </footer>
    </div>
  );
}

export function PayslipModal({ payslip, onClose }) {
  const { t } = useI18n();
  return (
    <Modal wide title={t("slip.modal_title")} onClose={onClose} className="print-area"
      footer={<>
        <button className="btn" onClick={onClose}>{t("common.close")}</button>
        <button className="btn primary" onClick={() => window.print()}><Printer size={16} />{t("slip.print")}</button>
      </>}>
      <PayslipDoc p={payslip} />
    </Modal>
  );
}
