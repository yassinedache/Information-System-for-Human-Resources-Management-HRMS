import { useState } from "react";
import { FileText } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, useApi } from "../../ui.jsx";
import { PayslipModal } from "../Payslip.jsx";

export default function MyPayslips() {
  const i = useI18n();
  const { t } = i;
  const [open, setOpen] = useState(null);
  const q = useApi(() => api.get("/me/payslips/"));
  return (
    <>
      <div className="page-head"><div><h1>{t("me.slips_title")}</h1><p>{t("me.slips_sub")}</p></div></div>
      <Async q={q}>
        {(rows) => rows.length ? (
          <div className="jobs">
            {rows.map((p) => (
              <button key={p.id} className="card job" style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => setOpen(p)}>
                <div className="row between">
                  <span className="badge blue"><FileText size={13} />{t("slip.title")}</span>
                  <span className="muted small">{t("slip.validated_on", { date: i.date(p.validated_at) })}</span>
                </div>
                <h3 style={{ textTransform: "capitalize" }}>{i.month(p.period)}</h3>
                <div className="row between">
                  <span className="muted">{t("slip.net")}</span>
                  <b style={{ fontSize: "1.25rem", color: "var(--primary)" }}>{i.money(p.net)}</b>
                </div>
                <div className="meta">
                  <span>{t("slip.gross")} : {i.money(p.gross)}</span>
                  {Number(p.bonus) > 0 && <span>{t("slip.bonus")} : {i.money(p.bonus)}</span>}
                </div>
              </button>
            ))}
          </div>
        ) : <div className="card"><Empty icon={FileText}>{t("me.no_slips")}</Empty></div>}
      </Async>
      {open && <PayslipModal payslip={open} onClose={() => setOpen(null)} />}
    </>
  );
}
