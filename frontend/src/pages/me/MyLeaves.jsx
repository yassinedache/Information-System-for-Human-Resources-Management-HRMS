import { useState } from "react";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, useApi, useConfirm, useToast } from "../../ui.jsx";
import { BalanceCard } from "../hr/EmployeeDetail.jsx";
import { LeaveForm, LeaveRows } from "../hr/Leaves.jsx";

export default function MyLeaves() {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [creating, setCreating] = useState(false);
  const q = useApi(() => api.get("/me/leaves/"));

  const cancel = async (lv) => {
    if (!(await confirm(t("me.cancel_confirm"), { label: t("leaves.cancel") }))) return;
    try {
      await api.post(`/me/leaves/${lv.id}/cancel/`, {});
      toast(t("leaves.cancelled"));
      q.reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>{t("me.leaves_title")}</h1><p>{t("me.leaves_sub")}</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><CalendarPlus size={16} />{t("leaves.request")}</button>
      </div>
      <Async q={q}>
        {(d) => (
          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
            <div className="grid two">
              <BalanceCard balance={d.balance} title={t("me.my_balance", { year: d.balance.year })} />
              <div className="card">
                <div className="card-head"><h3>{t("me.rules_title")}</h3></div>
                <div className="card-body">
                  <ul className="small stack" style={{ gap: 8, paddingLeft: 18 }}>
                    <li>{t("leaves.type_rule_annual")}</li>
                    <li>{t("leaves.type_rule_sick")}</li>
                    <li>{t("leaves.type_rule_maternity")}</li>
                    <li>{t("leaves.type_rule_paternity")}</li>
                    <li>{t("me.rule_validation")}</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>{t("me.my_requests")}</h3></div>
              {d.leaves.length ? <LeaveRows rows={d.leaves} showEmployee={false} onCancel={cancel} />
                : <Empty icon={CalendarDays}>{t("me.no_leaves")}</Empty>}
            </div>
          </div>
        )}
      </Async>
      {creating && <LeaveForm mine onClose={() => setCreating(false)} onSaved={() => { setCreating(false); toast(t("me.leave_sent")); q.reload(); }} />}
      {confirmNode}
    </>
  );
}
