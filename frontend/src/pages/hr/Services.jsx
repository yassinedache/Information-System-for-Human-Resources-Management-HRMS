import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { api } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Async, Empty, Field, FormModal, Input, Textarea, formObject, useApi, useConfirm, useToast } from "../../ui.jsx";

export default function Services() {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [editing, setEditing] = useState(null);
  const list = useApi(() => api.get("/services/"));

  const remove = async (s) => {
    if (!(await confirm(t("services.delete_confirm", { name: s.name }), { label: t("common.delete") }))) return;
    try {
      await api.del(`/services/${s.id}/`);
      toast(t("services.deleted"));
      list.reload();
    } catch (err) {
      toast(i.error(err), "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>{t("services.title")}</h1><p>{t("services.sub")}</p></div>
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={16} />{t("services.new")}</button>
      </div>
      <Async q={list}>
        {(rows) => rows.length ? (
          <div className="features">
            {rows.map((s) => (
              <div key={s.id} className="card feature">
                <div className="row between">
                  <span className="ico"><Building2 size={20} /></span>
                  <div className="row" style={{ gap: 2 }}>
                    <button className="btn ghost sm icon" onClick={() => setEditing(s)} title={t("common.edit")} aria-label={t("common.edit")}><Pencil size={15} /></button>
                    <button className="btn ghost sm icon" onClick={() => remove(s)} title={t("common.delete")} aria-label={t("common.delete")}><Trash2 size={15} /></button>
                  </div>
                </div>
                <h3>{s.name}</h3>
                <p>{s.description || "—"}</p>
                <Link to={`/hr/employees?service=${s.id}`} className="row small" style={{ gap: 6, marginTop: "auto" }}>
                  <Users size={15} />{t("services.employees_n", { n: s.employee_count })}
                </Link>
              </div>
            ))}
          </div>
        ) : <div className="card"><Empty icon={Building2}>{t("services.none")}</Empty></div>}
      </Async>
      {editing && (
        <FormModal title={editing.id ? t("services.edit") : t("services.new")} onClose={() => setEditing(null)}
          submit={async (fd) => {
            const data = formObject(fd);
            if (editing.id) await api.patch(`/services/${editing.id}/`, data); else await api.post("/services/", data);
            setEditing(null);
            toast(t("services.saved"));
            list.reload();
          }}>
          <Field label={t("field.name")} name="name"><Input name="name" required defaultValue={editing.name} /></Field>
          <Field label={t("field.description")} name="description"><Textarea name="description" rows={3} defaultValue={editing.description} /></Field>
        </FormModal>
      )}
      {confirmNode}
    </>
  );
}
