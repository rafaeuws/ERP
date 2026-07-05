import React, { useState, useEffect, useCallback } from "react";
import { almox } from "./api.js";
import { ALMOX_CSS } from "./almoxCss.js";
import * as XLSX from "xlsx";

/* ============================================================
   MÓDULO ALMOXARIFADO (ERP) — layout ORIGINAL do Almoxarifado Cloud
   (menu lateral / sidebar). Reaproveita toda a lógica de dados e
   apenas veste o JSX com as classes originais (.app grid, .sidebar,
   .topbar, .content, .appfoot, .kpi, .card, .tbl-wrap, .pill, ...).
   ============================================================ */

const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDT = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const todayInput = () => new Date().toLocaleDateString("en-CA");
const brDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const UNIDADES = ["UN", "CX", "PCT", "KG", "G", "L", "ML", "M", "M²", "M³", "PAR", "DZ", "RL", "FD", "GL", "LATA", "SC", "FR", "KIT"];
const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const ROLE_NAMES = { admin: "Administrador", gerente: "Gerente", supervisor: "Supervisor de A&B", almoxarifado: "Almoxarifado", atendente: "Atendente" };
const rolesOfU = (u) => !u ? [] : (Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []));
const roleLabel = (r) => ROLE_NAMES[r] || r;
const rolesLabel = (u) => { const rs = rolesOfU(u); return rs.length ? rs.map((r) => ROLE_NAMES[r] || r).join(" · ") : "—"; };
const canStock = (u) => rolesOfU(u).some((r) => r === "admin" || r === "almoxarifado");
const canApprove = canStock;

/* ---------------- ícones SVG (do sistema original) ---------------- */
const ICONS = {
  dash: '<path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 3v8h8V3zM3 21h8v-4H3z"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  tag: '<path d="M20 10 12 2H4v8l8 8z"/><circle cx="7" cy="7" r="1.5"/>',
  truck: '<path d="M1 3h13v10H1zM14 8h4l3 3v2h-7z"/><circle cx="5.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/>',
  in: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  out: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  adj: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  clipboard: '<path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/>',
  ledger: '<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M8 8h7M8 12h7"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  approve: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01 9 11.01"/>',
  reject: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  hotel: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h6v6H9z"/>',
};
const Ic = ({ name, cls }) => (
  <svg className={"ic " + (cls || "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }} />
);

/* ---------------- pills ---------------- */
const statusItem = (i) => (i.estoqueAtual <= 0 ? "zero" : i.estoqueAtual <= i.estoqueMinimo ? "low" : "ok");
const PillItem = ({ i }) => {
  const s = statusItem(i);
  return s === "zero" ? <span className="pill zero">Zerado</span> : s === "low" ? <span className="pill low">Baixo</span> : <span className="pill ok">Normal</span>;
};
const PillReq = ({ s }) =>
  s === "pendente" ? <span className="pill pend">Pendente</span>
  : s === "aprovada" ? <span className="pill aprov">Aprovada</span>
  : s === "rejeitada" ? <span className="pill rej">Rejeitada</span>
  : <span className="pill muted">—</span>;
const PillTipo = ({ t }) =>
  t === "entrada" ? <span className="pill in">Entrada</span> : t === "saida" ? <span className="pill out">Saída</span> : <span className="pill adj">Ajuste</span>;

/* ---------------- modal (layout original) ---------------- */
function Modal({ title, children, onClose, onConfirm, confirmLabel = "Salvar", wide, busy, err, footExtra }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="fechar"><Ic name="reject" /></button></div>
        <div className="modal-body">
          {err && <div className="modal-err">{err}</div>}
          {children}
        </div>
        {(onConfirm || footExtra) && (
          <div className="modal-foot">
            {footExtra}
            <button className="btn" onClick={onClose}>Cancelar</button>
            {onConfirm && <button className="btn primary" disabled={busy} onClick={onConfirm}>{busy ? "Salvando…" : confirmLabel}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- editor de linhas ---------------- */
function Linhas({ linhas, setLinhas, itens, comCusto }) {
  const ativos = itens.filter((i) => i.ativo !== false);
  const cols = comCusto ? "1fr 90px 120px 34px" : "1fr 90px 110px 34px";
  const up = (idx, f, v) => setLinhas(linhas.map((l, i) => (i === idx ? { ...l, [f]: v } : l)));
  const del = (idx) => setLinhas(linhas.filter((_, i) => i !== idx));
  const add = () => setLinhas([...linhas, { itemId: ativos[0] ? ativos[0].id : "", quantidade: "", custoUnitario: "" }]);
  return (
    <div>
      <div className="li-head" style={{ gridTemplateColumns: cols }}>
        <div>Item</div><div>Qtd.</div><div>{comCusto ? "Custo unit." : "Em estoque"}</div><div />
      </div>
      {linhas.map((l, idx) => {
        const it = itens.find((x) => x.id === l.itemId);
        return (
          <div className="li-row" style={{ gridTemplateColumns: cols }} key={idx}>
            <select value={l.itemId} onChange={(e) => up(idx, "itemId", e.target.value)}>
              {ativos.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}
            </select>
            <input type="number" min="0" step="any" placeholder="qtd" value={l.quantidade} onChange={(e) => up(idx, "quantidade", e.target.value)} />
            {comCusto
              ? <input type="number" min="0" step="0.01" placeholder="0,00" value={l.custoUnitario} onChange={(e) => up(idx, "custoUnitario", e.target.value)} />
              : <span className="stk">{it ? fmtNum(it.estoqueAtual) + " " + it.unidade : ""}</span>}
            <button className="icon-btn danger" onClick={() => del(idx)} aria-label="remover"><Ic name="trash" /></button>
          </div>
        );
      })}
      <button className="btn sm" style={{ marginTop: 4 }} onClick={add}><Ic name="plus" /> Adicionar item</button>
    </div>
  );
}

/* ============ PAINEL ============ */
function Painel({ hotel, go, user, flash }) {
  const [d, setD] = useState(null);
  useEffect(() => { almox.dashboard(hotel.id).then(setD).catch((e) => flash(e.message)); }, [hotel.id]); // eslint-disable-line
  if (!d) return <p className="t-sub">Carregando painel…</p>;
  return (
    <div>
      <div className="kpis">
        <div className="kpi"><div className="accent" /><div className="label">Itens cadastrados</div><div className="val">{d.totalItens}</div><div className="foot">{d.ativos} ativos · {d.zerados} zerados</div></div>
        <div className="kpi money"><div className="accent" /><div className="label">Valor em estoque</div><div className="val" style={{ fontSize: 21 }}>{fmtBRL(d.valorEstoque)}</div><div className="foot">a custo médio</div></div>
        <div className={"kpi" + (d.estoqueBaixo ? " warn" : "")}><div className="accent" /><div className="label">Ponto de reposição</div><div className="val">{d.estoqueBaixo}</div><div className="foot">no/abaixo do mínimo</div></div>
        <div className={"kpi" + (d.requisicoesPendentes ? " out" : "")}><div className="accent" /><div className="label">Requisições pendentes</div><div className="val">{d.requisicoesPendentes}</div><div className="foot">{canApprove(user) ? "aguardando aprovação" : "em análise"}</div></div>
      </div>

      {canApprove(user) && d.requisicoesPendentes > 0 && (
        <div className="statusbar warn row" style={{ justifyContent: "space-between" }}>
          <span>Há <b>{d.requisicoesPendentes}</b> requisição(ões) aguardando aprovação. O estoque só é abatido ao aprovar.</span>
          <button className="btn sm primary" onClick={() => go("requisicoes")}>Analisar</button>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><Ic name="box" /><h3>Alertas de reposição</h3><span className="spacer" /><button className="btn sm" onClick={() => go("itens")}>ver itens</button></div>
          {!d.alertas.length ? <div className="empty"><Ic name="check" /><p>Nenhum item no ponto de reposição.</p></div> : (
            <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table><thead><tr><th>Item</th><th className="r">Atual</th><th className="r">Mínimo</th><th>Status</th></tr></thead><tbody>
                {d.alertas.map((i) => (
                  <tr key={i.id}><td><span className="t-desc">{i.descricao}</span> <span className="t-code">{i.codigo}</span></td>
                    <td className="num">{fmtNum(i.estoqueAtual)} <span className="t-sub">{i.unidade}</span></td>
                    <td className="num">{fmtNum(i.estoqueMinimo)}</td><td><PillItem i={i} /></td></tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><Ic name="ledger" /><h3>Movimentações recentes</h3><span className="spacer" /><button className="btn sm" onClick={() => go("kardex")}>kardex</button></div>
          {!d.recentes.length ? <div className="empty"><p>Registre uma entrada ou requisição.</p></div> : (
            <div className="tbl-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table><thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th className="r">Qtd</th></tr></thead><tbody>
                {d.recentes.map((m) => (
                  <tr key={m.id}><td className="t-sub mono">{fmtDate(m.data)}</td><td>{m.descricao}</td><td><PillTipo t={m.tipo} /></td>
                    <td className={"num " + (m.tipo === "saida" ? "mv-out" : m.tipo === "entrada" ? "mv-in" : "mv-adj")}>{m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}{fmtNum(m.quantidade)}</td></tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ ITENS ============ */
function Itens({ hotel, user, flash }) {
  const [itens, setItens] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const podeEditar = canStock(user);

  const load = useCallback(() => {
    Promise.all([almox.itens(hotel.id), almox.categorias(hotel.id)])
      .then(([i, c]) => { setItens(i); setCats(c); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const abrir = (item) => {
    setErr("");
    setF(item
      ? { codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, categoriaId: item.categoriaId || "", localizacao: item.localizacao || "", estoqueMinimo: item.estoqueMinimo, ativo: item.ativo !== false }
      : { codigo: "", descricao: "", unidade: "UN", categoriaId: "", localizacao: "", estoqueAtual: "", estoqueMinimo: "", custoMedio: "", ativo: true });
    setModal(item ? { mode: "edit", item } : { mode: "new" });
  };
  const salvar = async () => {
    setBusy(true); setErr("");
    try {
      if (modal.mode === "new") { await almox.criarItem(hotel.id, f); flash("Item cadastrado"); }
      else { await almox.editarItem(hotel.id, modal.item.id, f); flash("Item atualizado"); }
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.descricao}"? Itens com movimentação devem ser inativados.`)) return;
    try { await almox.excluirItem(hotel.id, item.id); flash("Item excluído"); load(); } catch (e) { alert(e.message); }
  };

  const toNum = (v) => {
    if (typeof v === "number") return v;
    if (v == null) return NaN;
    let t = String(v).trim().replace(/r\$/i, "").replace(/\s/g, "");
    if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
    else if (t.includes(",")) t = t.replace(",", ".");
    return Number(t);
  };
  const baixarModelo = () => {
    const aoa = [["Código", "Descrição", "Unidade", "Estoque mínimo", "Estoque inicial", "Custo unitário (R$)"],
      ["CN001", "Caneta esferográfica azul", "UN", 50, 200, 1.2], ["DT001", "Detergente neutro 5L", "GL", 4, 10, 18.9]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 10 }, { wch: 36 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Itens");
    XLSX.writeFile(wb, "modelo-itens-almoxarifado.xlsx");
  };
  const importarExcel = async (file) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
      const parsed = [];
      rows.forEach((r, i) => {
        const codigo = (r && r[0] != null ? String(r[0]) : "").trim();
        const descricao = (r && r[1] != null ? String(r[1]) : "").trim();
        if (!descricao) return;
        const min = toNum(r[3]), ini = toNum(r[4]), custo = toNum(r[5]);
        if (i === 0 && Number.isNaN(min) && Number.isNaN(ini)) return;
        parsed.push({ codigo, descricao, unidade: (r[2] != null ? String(r[2]).trim().toUpperCase() : "") || "UN",
          estoqueMinimo: Number.isNaN(min) ? 0 : Math.max(0, min), estoqueAtual: Number.isNaN(ini) ? 0 : Math.max(0, ini), custo: Number.isNaN(custo) ? 0 : Math.max(0, custo) });
      });
      if (!parsed.length) { alert("Não encontrei itens na planilha. Colunas: A código, B descrição, C unidade, D mínimo, E estoque inicial, F custo."); return; }
      const out = await almox.importarItens(hotel.id, parsed);
      flash(`Importação: ${out.added} novo(s), ${out.updated} atualizado(s)`); load();
    } catch (e) { alert("Não foi possível importar: " + (e.message || e)); }
    finally { setImporting(false); }
  };

  if (!itens) return <p className="t-sub">Carregando itens…</p>;
  const list = itens.filter((i) => !q || (i.descricao + " " + i.codigo).toLowerCase().includes(q.toLowerCase()));
  const catName = (id) => (cats.find((c) => c.id === id) || {}).nome || "";

  return (
    <div>
      <div className="toolbar">
        <div className="search"><Ic name="search" cls="ic-sm" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou descrição…" /></div>
        <span className="spacer" />
        {podeEditar && <button className="btn primary" onClick={() => abrir(null)}><Ic name="plus" /> Novo item</button>}
      </div>

      {podeEditar && (
        <div className="card">
          <div className="card-head"><Ic name="download" /><h3>Importar do Excel</h3></div>
          <div className="card-body">
            <p className="t-sub" style={{ marginBottom: 12 }}>Planilha com <b>A</b> código, <b>B</b> descrição, <b>C</b> unidade, <b>D</b> estoque mínimo, <b>E</b> estoque inicial e <b>F</b> custo unitário. Itens já existentes são atualizados; os novos entram com o estoque inicial lançado no Kardex.</p>
            <div className="row">
              <label className="btn primary filebtn">{importing ? "Importando…" : "Escolher planilha"}
                <input type="file" accept=".xlsx,.xls,.csv" disabled={importing} onChange={(e) => { if (e.target.files && e.target.files[0]) importarExcel(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <button className="btn" onClick={baixarModelo}><Ic name="download" /> Baixar modelo</button>
            </div>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        {list.length === 0 ? <div className="empty"><Ic name="box" /><h4>Nenhum item {q ? "encontrado" : "cadastrado"}</h4><p>{q ? "Tente outro termo de busca." : "Cadastre itens ou importe do Excel."}</p></div> : (
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="r">Estoque</th><th className="r">Mínimo</th><th className="r">Custo méd.</th><th>Status</th>{podeEditar && <th className="r">Ações</th>}</tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="t-code">{i.codigo}</td>
                  <td><span className="t-desc">{i.descricao}</span>{i.ativo === false && <span className="pill muted" style={{ marginLeft: 6 }}>inativo</span>}{i.categoriaId && <div className="t-sub">{catName(i.categoriaId)}</div>}</td>
                  <td className="t-sub">{i.unidade}</td>
                  <td className="num">{fmtNum(i.estoqueAtual)}</td>
                  <td className="num t-sub">{fmtNum(i.estoqueMinimo)}</td>
                  <td className="num t-sub">{fmtBRL(i.custoMedio)}</td>
                  <td><PillItem i={i} /></td>
                  {podeEditar && <td className="actions-cell"><button className="icon-btn" onClick={() => abrir(i)} title="editar"><Ic name="edit" /></button><button className="icon-btn danger" onClick={() => excluir(i)} title="excluir"><Ic name="trash" /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="t-sub" style={{ marginTop: 10 }}>{itens.length} itens · o saldo só muda por entradas, requisições aprovadas, ajustes e contagens.</p>

      {modal && (
        <Modal title={modal.mode === "new" ? "Novo item" : "Editar item"} wide onClose={() => setModal(null)} onConfirm={salvar} busy={busy} err={err} confirmLabel={modal.mode === "new" ? "Cadastrar" : "Salvar"}>
          <div className="field-row c2">
            <div className="field"><label>Código *</label><input value={f.codigo} disabled={modal.mode === "edit"} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></div>
            <div className="field"><label>Unidade</label><select value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></div>
          </div>
          <div className="field"><label>Descrição *</label><input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
          <div className="field-row c2">
            <div className="field"><label>Categoria</label><select value={f.categoriaId} onChange={(e) => setF({ ...f, categoriaId: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div className="field"><label>Localização</label><input value={f.localizacao} placeholder="ex.: prateleira A3" onChange={(e) => setF({ ...f, localizacao: e.target.value })} /></div>
          </div>
          <div className="field-row c2">
            {modal.mode === "new"
              ? <div className="field"><label>Estoque inicial</label><input type="number" min="0" step="any" value={f.estoqueAtual} onChange={(e) => setF({ ...f, estoqueAtual: e.target.value })} /></div>
              : <div className="field"><label>Situação</label><select value={f.ativo ? "1" : "0"} onChange={(e) => setF({ ...f, ativo: e.target.value === "1" })}><option value="1">Ativo</option><option value="0">Inativo</option></select></div>}
            <div className="field"><label>Estoque mínimo</label><input type="number" min="0" step="any" value={f.estoqueMinimo} onChange={(e) => setF({ ...f, estoqueMinimo: e.target.value })} /></div>
          </div>
          {modal.mode === "new" && <div className="field"><label>Custo unitário (R$)</label><input type="number" min="0" step="0.01" value={f.custoMedio} onChange={(e) => setF({ ...f, custoMedio: e.target.value })} /></div>}
          {modal.mode === "edit" && <p className="t-sub">Saldo e custo médio mudam por Entradas, Ajustes ou Contagem — preservando o histórico.</p>}
        </Modal>
      )}
    </div>
  );
}

/* ============ CATEGORIAS ============ */
function Categorias({ hotel, flash }) {
  const [cats, setCats] = useState(null);
  const [nova, setNova] = useState("");
  const load = useCallback(() => { almox.categorias(hotel.id).then(setCats).catch((e) => flash(e.message)); }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!nova.trim()) return; try { await almox.criarCategoria(hotel.id, nova.trim()); setNova(""); load(); } catch (e) { alert(e.message); } };
  const ren = async (c) => { const n = window.prompt("Novo nome da categoria:", c.nome); if (n && n.trim()) { try { await almox.editarCategoria(hotel.id, c.id, n.trim()); load(); } catch (e) { alert(e.message); } } };
  const del = async (c) => { if (window.confirm(`Excluir a categoria "${c.nome}"? Os itens dela ficam sem categoria.`)) { try { await almox.excluirCategoria(hotel.id, c.id); load(); } catch (e) { alert(e.message); } } };
  if (!cats) return <p className="t-sub">Carregando…</p>;
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card">
        <div className="card-head"><Ic name="tag" /><h3>Categorias de itens</h3></div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 6 }}>
            <input style={{ flex: 1, minWidth: 200, border: "1px solid var(--line-strong)", borderRadius: 8, padding: "9px 12px", background: "var(--surface)", color: "var(--ink)" }}
              value={nova} placeholder="Nova categoria…" onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="btn primary" onClick={add}><Ic name="plus" /> Adicionar</button>
          </div>
        </div>
      </div>
      <div className="tbl-wrap">
        {cats.length === 0 ? <div className="empty"><p>Nenhuma categoria cadastrada.</p></div> : (
          <table><thead><tr><th>Categoria</th><th className="r">Ações</th></tr></thead><tbody>
            {cats.map((c) => (
              <tr key={c.id}><td className="t-desc">{c.nome}</td>
                <td className="actions-cell"><button className="icon-btn" onClick={() => ren(c)} title="renomear"><Ic name="edit" /></button><button className="icon-btn danger" onClick={() => del(c)} title="excluir"><Ic name="trash" /></button></td></tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  );
}

/* ============ FORNECEDORES ============ */
function Fornecedores({ hotel, flash }) {
  const [forns, setForns] = useState(null);
  const [modal, setModal] = useState(null);
  const [ff, setFf] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { almox.fornecedores(hotel.id).then(setForns).catch((e) => flash(e.message)); }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const abrir = (forn) => { setErr(""); setFf(forn ? { ...forn } : { nome: "", cnpj: "", contato: "", telefone: "", email: "" }); setModal(forn ? { mode: "edit", forn } : { mode: "new" }); };
  const salvar = async () => {
    setBusy(true); setErr("");
    try { if (modal.mode === "new") await almox.criarFornecedor(hotel.id, ff); else await almox.editarFornecedor(hotel.id, modal.forn.id, ff); flash("Fornecedor salvo"); setModal(null); load(); }
    catch (e) { setErr(e.message); } setBusy(false);
  };
  const del = async (f) => { if (window.confirm(`Excluir o fornecedor "${f.nome}"?`)) { try { await almox.excluirFornecedor(hotel.id, f.id); load(); } catch (e) { alert(e.message); } } };
  if (!forns) return <p className="t-sub">Carregando…</p>;
  return (
    <div>
      <div className="toolbar"><span className="spacer" /><button className="btn primary" onClick={() => abrir(null)}><Ic name="plus" /> Novo fornecedor</button></div>
      <div className="tbl-wrap">
        {forns.length === 0 ? <div className="empty"><Ic name="truck" /><h4>Nenhum fornecedor</h4><p>Cadastre fornecedores para vinculá-los às entradas.</p></div> : (
          <table><thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Telefone</th><th className="r">Ações</th></tr></thead><tbody>
            {forns.map((f) => (
              <tr key={f.id}><td className="t-desc">{f.nome}</td><td className="t-sub">{f.cnpj || "—"}</td><td className="t-sub">{f.contato || "—"}</td><td className="t-sub">{f.telefone || "—"}</td>
                <td className="actions-cell"><button className="icon-btn" onClick={() => abrir(f)} title="editar"><Ic name="edit" /></button><button className="icon-btn danger" onClick={() => del(f)} title="excluir"><Ic name="trash" /></button></td></tr>
            ))}
          </tbody></table>
        )}
      </div>
      {modal && (
        <Modal title={modal.mode === "new" ? "Novo fornecedor" : "Editar fornecedor"} wide onClose={() => setModal(null)} onConfirm={salvar} busy={busy} err={err}>
          <div className="field"><label>Nome *</label><input value={ff.nome} onChange={(e) => setFf({ ...ff, nome: e.target.value })} /></div>
          <div className="field-row c2">
            <div className="field"><label>CNPJ</label><input value={ff.cnpj} onChange={(e) => setFf({ ...ff, cnpj: e.target.value })} /></div>
            <div className="field"><label>Telefone</label><input value={ff.telefone} onChange={(e) => setFf({ ...ff, telefone: e.target.value })} /></div>
          </div>
          <div className="field-row c2">
            <div className="field"><label>Contato</label><input value={ff.contato} onChange={(e) => setFf({ ...ff, contato: e.target.value })} /></div>
            <div className="field"><label>E-mail</label><input value={ff.email} onChange={(e) => setFf({ ...ff, email: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============ ENTRADAS ============ */
function Entradas({ hotel, user, flash }) {
  const [entradas, setEntradas] = useState(null);
  const [itens, setItens] = useState([]);
  const [forns, setForns] = useState([]);
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    Promise.all([almox.entradas(hotel.id), almox.itens(hotel.id), almox.fornecedores(hotel.id)])
      .then(([e, i, fo]) => { setEntradas(e); setItens(i); setForns(fo); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const abrir = () => {
    if (!itens.length) return flash("Cadastre itens antes de registrar entradas.");
    setErr(""); setF({ fornecedorId: "", notaFiscal: "", data: todayInput(), obs: "" });
    setLinhas([{ itemId: (itens.find((i) => i.ativo !== false) || {}).id || "", quantidade: "", custoUnitario: "" }]); setNovo(true);
  };
  const salvar = async () => {
    setBusy(true); setErr("");
    try {
      const its = linhas.filter((l) => l.itemId && Number(l.quantidade) > 0).map((l) => ({ itemId: l.itemId, quantidade: Number(l.quantidade), custoUnitario: Number(l.custoUnitario) || 0 }));
      if (!its.length) throw new Error("Adicione ao menos um item com quantidade.");
      const out = await almox.criarEntrada(hotel.id, { ...f, itens: its });
      flash(`Entrada ${out.numero} registrada — estoque atualizado`); setNovo(false); load();
    } catch (e) { setErr(e.message); } setBusy(false);
  };
  if (!entradas) return <p className="t-sub">Carregando entradas…</p>;
  return (
    <div>
      <div className="toolbar"><span className="spacer" />{canStock(user) && <button className="btn primary" onClick={abrir}><Ic name="plus" /> Nova entrada</button>}</div>
      <div className="tbl-wrap">
        {entradas.length === 0 ? <div className="empty"><Ic name="in" /><h4>Nenhuma entrada registrada</h4><p>As entradas alimentam o estoque e recalculam o custo médio.</p></div> : (
          <table><thead><tr><th>Nº</th><th>Data</th><th>Fornecedor</th><th>NF</th><th className="r">Itens</th></tr></thead><tbody>
            {entradas.map((e) => (
              <tr key={e.id}><td className="t-code">{e.numero}</td><td className="t-sub mono">{fmtDate(e.data)}</td><td>{e.fornecedorNome || "—"}</td><td className="t-sub">{e.notaFiscal || "—"}</td><td className="num">{e.qtdItens}</td></tr>
            ))}
          </tbody></table>
        )}
      </div>
      {novo && (
        <Modal title="Nova entrada" wide onClose={() => setNovo(false)} onConfirm={salvar} busy={busy} err={err} confirmLabel="Registrar entrada">
          <div className="field-row c2">
            <div className="field"><label>Fornecedor</label><select value={f.fornecedorId} onChange={(e) => setF({ ...f, fornecedorId: e.target.value })}><option value="">—</option>{forns.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
            <div className="field"><label>Nota fiscal</label><input value={f.notaFiscal} onChange={(e) => setF({ ...f, notaFiscal: e.target.value })} /></div>
          </div>
          <div className="field" style={{ maxWidth: 200 }}><label>Data</label><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
          <div className="section-title" style={{ margin: "6px 0 10px" }}>Itens da entrada</div>
          <Linhas linhas={linhas} setLinhas={setLinhas} itens={itens} comCusto />
          <div className="field" style={{ marginTop: 12 }}><label>Observação</label><input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
          <p className="t-sub">O custo unitário informado recalcula o <b>custo médio ponderado</b> de cada item.</p>
        </Modal>
      )}
    </div>
  );
}

/* ============ REQUISIÇÕES ============ */
function Requisicoes({ hotel, user, flash, onPendChange }) {
  const [reqs, setReqs] = useState(null);
  const [itens, setItens] = useState([]);
  const [open, setOpen] = useState(null);
  const [novo, setNovo] = useState(false);
  const [aprovando, setAprovando] = useState(null);
  const [rejeitando, setRejeitando] = useState(null);
  const [f, setF] = useState({});
  const [linhas, setLinhas] = useState([]);
  const [reais, setReais] = useState({});
  const [obsA, setObsA] = useState("");
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtro, setFiltro] = useState("all");

  const load = useCallback(() => {
    Promise.all([almox.requisicoes(hotel.id), almox.itens(hotel.id)])
      .then(([r, i]) => { setReqs(r); setItens(i); onPendChange && onPendChange(r.filter((x) => x.status === "pendente").length); })
      .catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const abrirNovo = () => {
    if (!itens.filter((i) => i.ativo !== false).length) return flash("Cadastre itens antes de criar requisições.");
    setErr(""); setF({ requisitante: user.name, setor: "", data: todayInput(), obs: "" });
    setLinhas([{ itemId: (itens.find((i) => i.ativo !== false) || {}).id || "", quantidade: "" }]); setNovo(true);
  };
  const criar = async () => {
    setBusy(true); setErr("");
    try {
      const its = linhas.filter((l) => l.itemId && Number(l.quantidade) > 0).map((l) => ({ itemId: l.itemId, quantidade: Number(l.quantidade) }));
      if (!its.length) throw new Error("Adicione ao menos um item com quantidade.");
      const out = await almox.criarRequisicao(hotel.id, { ...f, itens: its });
      flash(`Requisição ${out.numero} criada — aguardando aprovação`); setNovo(false); load();
    } catch (e) { setErr(e.message); } setBusy(false);
  };
  const ver = async (id) => { try { setOpen(await almox.requisicao(hotel.id, id)); } catch (e) { flash(e.message); } };
  const abrirAprovar = async (id) => {
    try { const r = await almox.requisicao(hotel.id, id); const ini = {}; r.itens.forEach((l) => { ini[l.linhaId] = l.quantidade; }); setReais(ini); setObsA(""); setErr(""); setAprovando(r); setOpen(null); }
    catch (e) { flash(e.message); }
  };
  const aprovar = async () => {
    setBusy(true); setErr("");
    try {
      const body = {}; Object.keys(reais).forEach((k) => { body[k] = Number(reais[k]) || 0; });
      await almox.aprovarRequisicao(hotel.id, aprovando.id, { reais: body, obs: obsA });
      flash(`Requisição ${aprovando.numero} aprovada` + (aprovando.origem === "parstock" ? ' — "Reposto" lançado no PDV' : ""));
      setAprovando(null); load();
    } catch (e) { setErr(e.message); } setBusy(false);
  };
  const rejeitar = async () => {
    setBusy(true); setErr("");
    try { await almox.rejeitarRequisicao(hotel.id, rejeitando.id, motivo); flash(`Requisição ${rejeitando.numero} rejeitada`); setRejeitando(null); setOpen(null); load(); }
    catch (e) { setErr(e.message); } setBusy(false);
  };

  if (!reqs) return <p className="t-sub">Carregando requisições…</p>;
  const pend = reqs.filter((r) => r.status === "pendente").length;
  const list = filtro === "all" ? reqs : reqs.filter((r) => r.status === filtro);
  const FILTROS = [["all", "Todas"], ["pendente", "Pendentes" + (pend ? ` (${pend})` : "")], ["aprovada", "Aprovadas"], ["rejeitada", "Rejeitadas"]];

  return (
    <div>
      <div className="toolbar">
        <select className="filter" value={filtro} onChange={(e) => setFiltro(e.target.value)}>{FILTROS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span className="spacer" />
        <button className="btn primary" onClick={abrirNovo}><Ic name="plus" /> Nova requisição</button>
      </div>

      {canApprove(user) && pend > 0 && (
        <div className="statusbar warn">Há <b>{pend}</b> requisição(ões) aguardando aprovação. O estoque só é abatido ao aprovar, informando a quantidade real que saiu.</div>
      )}

      <div className="tbl-wrap">
        {list.length === 0 ? <div className="empty"><Ic name="out" /><h4>Nenhuma requisição {filtro !== "all" ? "neste filtro" : ""}</h4><p>Atendentes e a loja (Par Stock) criam requisições; o almoxarifado aprova e o saldo é abatido.</p></div> : (
          <table>
            <thead><tr><th>Nº</th><th>Data</th><th>Status</th><th>Origem</th><th>Solicitante</th><th className="r">Itens</th><th className="r">Valor</th><th className="r">Ações</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="t-code">{r.numero}</td>
                  <td className="t-sub mono">{fmtDate(r.data)}</td>
                  <td><PillReq s={r.status} /></td>
                  <td>{r.origem === "parstock" ? <span className="pill loja">🏪 {r.setor || "Loja"}</span> : <span className="t-sub">{r.setor || "—"}</span>}</td>
                  <td>{r.requisitante || "—"}</td>
                  <td className="num">{r.qtdItens}</td>
                  <td className="num t-sub">{fmtBRL(r.valor)}</td>
                  <td className="actions-cell">
                    <button className="icon-btn" onClick={() => ver(r.id)} title="ver"><Ic name="eye" /></button>
                    {r.status === "pendente" && canApprove(user) && (<>
                      <button className="icon-btn" onClick={() => abrirAprovar(r.id)} title="aprovar" style={{ color: "var(--in)" }}><Ic name="approve" /></button>
                      <button className="icon-btn danger" onClick={() => { setMotivo(""); setErr(""); setRejeitando(r); }} title="rejeitar"><Ic name="reject" /></button>
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* detalhe / impressão */}
      {open && (
        <Modal title={"Requisição " + open.numero} wide onClose={() => setOpen(null)}
          footExtra={<>
            <button className="btn" onClick={() => window.print()}><Ic name="print" /> Imprimir</button>
            {open.status === "pendente" && canApprove(user) && <button className="btn primary" onClick={() => abrirAprovar(open.id)}>Aprovar…</button>}
          </>}>
          <div className="print-zone">
            <div className="print-head"><div className="print-mk">AX</div><div><b>REQUISIÇÃO {open.numero}</b> — {hotel.name}<div className="t-sub">{fmtDT(open.data)} · {open.requisitante || "—"} · {open.setor || "—"}</div></div></div>
            <div className="detail-list" style={{ marginBottom: 14 }}>
              <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><PillReq s={open.status} /></span></div>
              <div className="dl-row"><span className="dl-k">Solicitante</span><span className="dl-v">{open.requisitante || "—"}</span></div>
              <div className="dl-row"><span className="dl-k">Setor</span><span className="dl-v">{open.setor || "—"}</span></div>
              {open.pdvName && <div className="dl-row"><span className="dl-k">Origem</span><span className="dl-v">Reposição do PDV {open.pdvName}{open.diaData ? " (" + brDate(open.diaData) + ")" : ""}</span></div>}
              {open.aprovadoPor && <div className="dl-row"><span className="dl-k">{open.status === "rejeitada" ? "Rejeitada por" : "Aprovada por"}</span><span className="dl-v">{open.aprovadoPor} · {fmtDT(open.aprovadoEm)}</span></div>}
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Item</th><th>Un.</th><th className="r">Solicitado</th><th className="r">Qtd real</th><th className="r">Custo méd.</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {open.itens.map((l) => {
                    const aprovada = open.status === "aprovada";
                    const base = aprovada && l.quantidadeReal != null ? l.quantidadeReal : l.quantidade;
                    const div = aprovada && l.quantidadeReal != null && l.quantidadeReal !== l.quantidade;
                    return (
                      <tr key={l.linhaId}>
                        <td className="t-desc">{l.descricao}</td><td className="t-sub">{l.unidade}</td>
                        <td className="num">{fmtNum(l.quantidade)}</td>
                        <td className={"num" + (div ? " diverg neg" : "")}>{aprovada ? fmtNum(l.quantidadeReal != null ? l.quantidadeReal : l.quantidade) : "—"}</td>
                        <td className="num t-sub">{fmtBRL(l.custoUnitario)}</td>
                        <td className="num">{fmtBRL(base * (l.custoUnitario || 0))}</td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan="5" className="num t-desc">Total</td><td className="num t-desc">{fmtBRL(open.itens.reduce((s, l) => s + (open.status === "aprovada" && l.quantidadeReal != null ? l.quantidadeReal : l.quantidade) * (l.custoUnitario || 0), 0))}</td></tr>
                </tbody>
              </table>
            </div>
            {open.obs && <p className="t-sub" style={{ marginTop: 10 }}>{open.obs}</p>}
            <div className="sign-row">
              <div className="sign-box"><div className="sign-line" /><div className="sign-label">Responsável pela requisição</div></div>
              <div className="sign-box"><div className="sign-line" /><div className="sign-label">Visto do subgerente</div></div>
            </div>
          </div>
        </Modal>
      )}

      {/* nova */}
      {novo && (
        <Modal title="Nova requisição de saída" wide onClose={() => setNovo(false)} onConfirm={criar} busy={busy} err={err} confirmLabel="Enviar para aprovação">
          <div className="field-row c2">
            <div className="field"><label>Solicitante *</label><input value={f.requisitante} onChange={(e) => setF({ ...f, requisitante: e.target.value })} /></div>
            <div className="field"><label>Setor / centro de custo</label><input value={f.setor} placeholder="ex.: Manutenção" onChange={(e) => setF({ ...f, setor: e.target.value })} /></div>
          </div>
          <div className="field" style={{ maxWidth: 200 }}><label>Data</label><input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
          <div className="section-title" style={{ margin: "6px 0 10px" }}>Itens solicitados</div>
          <Linhas linhas={linhas} setLinhas={setLinhas} itens={itens} />
          <div className="field" style={{ marginTop: 12 }}><label>Observação</label><input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
          <p className="t-sub">A requisição entra como <b>pendente</b>. O estoque só é abatido quando o almoxarifado (ou admin) aprovar.</p>
        </Modal>
      )}

      {/* aprovação */}
      {aprovando && (
        <Modal title={"Aprovar " + aprovando.numero} wide onClose={() => setAprovando(null)} onConfirm={aprovar} busy={busy} err={err} confirmLabel="Aprovar e abater estoque">
          {aprovando.origem === "parstock" && (
            <div className="statusbar ok">🏪 Reposição do PDV <b>{aprovando.pdvName || ""}</b>{aprovando.diaData ? " · dia " + brDate(aprovando.diaData) : ""}. Ao aprovar, a quantidade real vira <b>Reposto</b> na conciliação da loja.</div>
          )}
          <p className="t-sub" style={{ marginTop: 0, marginBottom: 10 }}>Informe a <b>quantidade real</b> que saiu de cada item. Divergências ficam registradas.</p>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Item</th><th className="r">Solicitado</th><th className="r">Em estoque</th><th className="r">Qtd. real</th></tr></thead>
              <tbody>
                {aprovando.itens.map((l) => (
                  <tr key={l.linhaId}>
                    <td className="t-desc">{l.descricao} <span className="t-sub">({l.unidade})</span></td>
                    <td className="num">{fmtNum(l.quantidade)}</td>
                    <td className={"num" + (l.estoqueAtual != null && l.estoqueAtual < l.quantidade ? " diverg neg" : " t-sub")}>{l.estoqueAtual == null ? "—" : fmtNum(l.estoqueAtual)}</td>
                    <td className="num"><input style={{ width: 84, textAlign: "right", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "7px 9px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }} type="number" min="0" step="any" value={reais[l.linhaId] ?? ""} onChange={(e) => setReais({ ...reais, [l.linhaId]: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>Observação da aprovação</label><input value={obsA} placeholder="opcional" onChange={(e) => setObsA(e.target.value)} /></div>
        </Modal>
      )}

      {/* rejeição */}
      {rejeitando && (
        <Modal title={"Rejeitar " + rejeitando.numero} onClose={() => setRejeitando(null)} onConfirm={rejeitar} busy={busy} err={err} confirmLabel="Rejeitar">
          <p className="t-sub" style={{ marginTop: 0 }}>Nenhum estoque será movimentado. Quem criou a requisição será notificado com o motivo.</p>
          <div className="field"><label>Motivo</label><input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </Modal>
      )}
    </div>
  );
}

/* ============ AJUSTES ============ */
function Ajustes({ hotel, flash }) {
  const [itens, setItens] = useState([]);
  const [aj, setAj] = useState({ itemId: "", novoSaldo: "", obs: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    almox.itens(hotel.id).then((i) => { setItens(i); setAj((p) => (p.itemId ? p : { ...p, itemId: i[0] ? i[0].id : "", novoSaldo: i[0] ? i[0].estoqueAtual : "" })); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const salvar = async () => {
    if (!aj.itemId) return;
    setBusy(true);
    try { await almox.ajuste(hotel.id, aj); flash("Ajuste registrado no Kardex"); setAj({ ...aj, obs: "" }); load(); } catch (e) { alert(e.message); }
    setBusy(false);
  };
  const itemSel = itens.find((i) => i.id === aj.itemId);
  const diff = itemSel ? (Number(aj.novoSaldo) || 0) - itemSel.estoqueAtual : 0;
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="card">
        <div className="card-head"><Ic name="adj" /><h3>Ajuste de saldo</h3></div>
        <div className="card-body">
          <p className="t-sub" style={{ marginBottom: 14 }}>Corrige o saldo de um item para o valor real, gerando uma movimentação de ajuste no Kardex.</p>
          <div className="field"><label>Item</label>
            <select value={aj.itemId} onChange={(e) => { const it = itens.find((i) => i.id === e.target.value); setAj({ ...aj, itemId: e.target.value, novoSaldo: it ? it.estoqueAtual : "" }); }}>
              {itens.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}
            </select>
          </div>
          <div className="field-row c2">
            <div className="field"><label>Saldo no sistema</label><input disabled value={itemSel ? fmtNum(itemSel.estoqueAtual) + " " + itemSel.unidade : ""} /></div>
            <div className="field"><label>Novo saldo (real)</label><input type="number" min="0" step="any" value={aj.novoSaldo} onChange={(e) => setAj({ ...aj, novoSaldo: e.target.value })} /></div>
          </div>
          {itemSel && diff !== 0 && <p className="t-sub" style={{ marginTop: -4, marginBottom: 12 }}>Diferença: <span className={"diverg " + (diff > 0 ? "pos" : "neg")}>{diff > 0 ? "+" : ""}{fmtNum(diff)}</span></p>}
          <div className="field"><label>Observação</label><input value={aj.obs} onChange={(e) => setAj({ ...aj, obs: e.target.value })} /></div>
          <button className="btn primary" disabled={busy || !aj.itemId} onClick={salvar}><Ic name="check" /> Registrar ajuste</button>
        </div>
      </div>
    </div>
  );
}

/* ============ CONTAGEM ============ */
function Contagem({ hotel, user, flash }) {
  const [itens, setItens] = useState([]);
  const [contagens, setContagens] = useState(null);
  const [folha, setFolha] = useState(null);
  const [verCont, setVerCont] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    Promise.all([almox.itens(hotel.id), almox.contagens(hotel.id)]).then(([i, c]) => { setItens(i); setContagens(c); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const ativos = itens.filter((i) => i.ativo !== false).slice().sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  const iniciar = () => { const valores = {}; ativos.forEach((i) => { valores[i.id] = i.estoqueAtual; }); setFolha({ resp: user.name, valores }); };
  const finalizar = async () => {
    const its = ativos.map((i) => ({ itemId: i.id, contado: Number(folha.valores[i.id]) }));
    const divergentes = ativos.filter((i) => Number(folha.valores[i.id]) !== i.estoqueAtual).length;
    if (!window.confirm(divergentes ? `Finalizar com ${divergentes} divergência(s)? Os saldos serão ajustados para o valor contado, gerando movimentações no Kardex.` : "Nenhuma divergência. Registrar a contagem?")) return;
    setBusy(true);
    try { const out = await almox.criarContagem(hotel.id, { responsavel: folha.resp, itens: its }); flash(`Contagem ${out.numero} finalizada — ${out.ajustes} ajuste(s)`); setFolha(null); load(); } catch (e) { alert(e.message); }
    setBusy(false);
  };

  if (folha) {
    return (
      <div>
        <div className="toolbar no-print">
          <div className="field" style={{ margin: 0, maxWidth: 300 }}><label>Responsável pela contagem</label><input value={folha.resp} onChange={(e) => setFolha({ ...folha, resp: e.target.value })} /></div>
          <span className="spacer" />
          <button className="btn" onClick={() => window.print()}><Ic name="print" /> Imprimir folha</button>
          <button className="btn" onClick={() => setFolha(null)}>Cancelar</button>
          <button className="btn primary" disabled={busy} onClick={finalizar}><Ic name="check" /> {busy ? "Finalizando…" : "Finalizar e ajustar"}</button>
        </div>
        <div className="tbl-wrap print-zone">
          <div className="print-head"><div className="print-mk">AX</div><div><b>CONTAGEM DE INVENTÁRIO</b> — {hotel.name}<div className="t-sub">{fmtDate(new Date().toISOString())} · Resp.: {folha.resp || "____________"}</div></div></div>
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="r">Sistema</th><th className="r">Contagem</th><th className="r no-print">Diverg.</th></tr></thead>
            <tbody>
              {ativos.map((i) => {
                const v = folha.valores[i.id]; const dv = (Number(v) || 0) - i.estoqueAtual;
                return (
                  <tr key={i.id}>
                    <td className="t-code">{i.codigo}</td><td className="t-desc">{i.descricao}</td><td className="t-sub">{i.unidade}</td>
                    <td className="num">{fmtNum(i.estoqueAtual)}</td>
                    <td className="num"><span className="no-print"><input style={{ width: 82, textAlign: "right", border: "1px solid var(--line-strong)", borderRadius: 8, padding: "6px 8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }} type="number" min="0" step="any" value={v} onChange={(e) => setFolha({ ...folha, valores: { ...folha.valores, [i.id]: e.target.value } })} /></span><span className="only-print cline" /></td>
                    <td className="num no-print">{dv === 0 ? <span className="diverg zero">0</span> : <span className={"diverg " + (dv > 0 ? "pos" : "neg")}>{dv > 0 ? "+" : ""}{fmtNum(dv)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="t-sub no-print" style={{ marginTop: 10 }}>Ao finalizar, as divergências geram <b>ajustes automáticos</b> no Kardex com o número da contagem.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar"><span className="spacer" /><button className="btn primary" disabled={!ativos.length} onClick={iniciar}><Ic name="clipboard" /> Iniciar nova contagem</button></div>
      {!ativos.length && <div className="statusbar warn">Cadastre itens ativos para poder contar o inventário.</div>}
      <div className="tbl-wrap">
        {!contagens ? <div className="empty"><p>Carregando…</p></div> : contagens.length === 0 ? <div className="empty"><Ic name="clipboard" /><h4>Nenhuma contagem registrada</h4><p>Inicie uma contagem para conferir o estoque físico.</p></div> : (
          <table><thead><tr><th>Nº</th><th>Data</th><th>Responsável</th><th className="r">Itens</th><th className="r">Divergências</th><th className="r">Ações</th></tr></thead><tbody>
            {contagens.map((c) => (
              <tr key={c.id}><td className="t-code">{c.numero}</td><td className="t-sub mono">{fmtDT(c.data)}</td><td>{c.responsavel || "—"}</td><td className="num">{c.qtdItens}</td>
                <td className="num">{c.ajustes ? <span className="pill low">{c.ajustes}</span> : <span className="pill ok">0</span>}</td>
                <td className="actions-cell"><button className="icon-btn" onClick={async () => { try { setVerCont(await almox.contagem(hotel.id, c.id)); } catch (e) { flash(e.message); } }} title="ver"><Ic name="eye" /></button></td></tr>
            ))}
          </tbody></table>
        )}
      </div>
      {verCont && (
        <Modal title={"Contagem " + verCont.numero} wide onClose={() => setVerCont(null)}>
          <p className="t-sub" style={{ marginTop: 0 }}>{fmtDT(verCont.data)} · Responsável: {verCont.responsavel || "—"} · {verCont.ajustes} ajuste(s)</p>
          <div className="tbl-wrap">
            <table><thead><tr><th>Item</th><th className="r">Sistema</th><th className="r">Contado</th><th className="r">Diverg.</th></tr></thead><tbody>
              {verCont.itens.map((l, i) => (
                <tr key={i}><td className="t-desc">{l.descricao}</td><td className="num t-sub">{fmtNum(l.sistema)}</td><td className="num">{fmtNum(l.contado)}</td>
                  <td className="num">{l.diverg === 0 ? <span className="diverg zero">0</span> : <span className={"diverg " + (l.diverg > 0 ? "pos" : "neg")}>{l.diverg > 0 ? "+" : ""}{fmtNum(l.diverg)}</span>}</td></tr>
              ))}
            </tbody></table>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============ KARDEX ============ */
function Kardex({ hotel, flash }) {
  const [movs, setMovs] = useState(null);
  const [itens, setItens] = useState([]);
  const [itemId, setItemId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const load = useCallback(() => {
    let q = [];
    if (itemId) q.push("itemId=" + itemId); if (de) q.push("de=" + de); if (ate) q.push("ate=" + ate);
    almox.movimentacoes(hotel.id, q.length ? "?" + q.join("&") : "").then(setMovs).catch((e) => flash(e.message));
  }, [hotel.id, itemId, de, ate]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { almox.itens(hotel.id).then(setItens).catch(() => {}); }, [hotel.id]); // eslint-disable-line
  return (
    <div>
      <div className="toolbar no-print">
        <select className="filter" value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">Todos os itens</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}
        </select>
        <input className="filter" type="date" value={de} onChange={(e) => setDe(e.target.value)} title="De" />
        <input className="filter" type="date" value={ate} onChange={(e) => setAte(e.target.value)} title="Até" />
        <span className="spacer" />
        <button className="btn" onClick={() => window.print()}><Ic name="print" /> Imprimir</button>
      </div>
      <div className="tbl-wrap print-zone">
        <div className="print-head"><div className="print-mk">AX</div><div><b>KARDEX</b> — {hotel.name}<div className="t-sub">{de || ate ? `${brDate(de) || "…"} a ${brDate(ate) || "…"}` : "Últimas movimentações"}</div></div></div>
        {!movs ? <div className="empty"><p>Carregando…</p></div> : movs.length === 0 ? <div className="empty"><Ic name="ledger" /><h4>Sem movimentações</h4><p>Ajuste os filtros ou registre entradas e saídas.</p></div> : (
          <table>
            <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th className="r">Qtd</th><th className="r">Custo unit.</th><th className="r">Saldo</th><th>Documento</th><th>Origem</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="t-sub mono">{fmtDT(m.data)}</td>
                  <td><span className="t-desc">{m.itemDescricao}</span> <span className="t-code">{m.itemCodigo}</span></td>
                  <td><PillTipo t={m.tipo} /></td>
                  <td className={"num " + (m.tipo === "saida" ? "mv-out" : m.tipo === "entrada" ? "mv-in" : "mv-adj")}>{m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}{fmtNum(m.quantidade)}</td>
                  <td className="num t-sub">{fmtBRL(m.custoUnitario)}</td>
                  <td className="num">{fmtNum(m.saldoApos)}</td>
                  <td className="t-code">{m.documento || "—"}</td>
                  <td className="t-sub">{m.origem || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============ RELATÓRIOS ============ */
function Relatorios({ hotel, flash }) {
  const [itens, setItens] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [rel, setRel] = useState("posicao");
  useEffect(() => {
    Promise.all([almox.itens(hotel.id), almox.requisicoes(hotel.id)]).then(([i, r]) => { setItens(i); setReqs(r); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  if (!itens) return <p className="t-sub">Carregando relatórios…</p>;

  const valorTotal = itens.reduce((s, i) => s + i.estoqueAtual * (i.custoMedio || 0), 0);
  const baixos = itens.filter((i) => i.ativo !== false && i.estoqueAtual <= i.estoqueMinimo);
  const comValor = itens.filter((i) => i.estoqueAtual * (i.custoMedio || 0) > 0).map((i) => ({ it: i, val: i.estoqueAtual * (i.custoMedio || 0) })).sort((a, b) => b.val - a.val);
  const totalABC = comValor.reduce((s, x) => s + x.val, 0) || 1;
  const porSetor = {};
  reqs.filter((r) => r.status === "aprovada").forEach((r) => { const k = r.setor || "(sem setor)"; porSetor[k] = (porSetor[k] || 0) + (r.valor || 0); });
  const setores = Object.entries(porSetor).sort((a, b) => b[1] - a[1]);
  const RELS = [["posicao", "Posição de estoque"], ["reposicao", "Itens para reposição"], ["abc", "Curva ABC"], ["setor", "Consumo por setor"]];
  const titulo = (RELS.find(([k]) => k === rel) || [])[1];

  return (
    <div>
      <div className="toolbar no-print">
        <select className="filter" value={rel} onChange={(e) => setRel(e.target.value)} style={{ minWidth: 220 }}>{RELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span className="spacer" />
        <button className="btn" onClick={() => window.print()}><Ic name="print" /> Imprimir</button>
      </div>
      <div className="tbl-wrap print-zone">
        <div className="print-head"><div className="print-mk">AX</div><div><b>{(titulo || "").toUpperCase()}</b> — {hotel.name}<div className="t-sub">Emitido em {new Date().toLocaleString("pt-BR")}</div></div></div>

        {rel === "posicao" && (itens.length === 0 ? <div className="empty"><p>Sem itens cadastrados.</p></div> : (
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th className="r">Saldo</th><th className="r">Custo méd.</th><th className="r">Valor</th><th>Status</th></tr></thead>
            <tbody>
              {itens.slice().sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")).map((i) => (
                <tr key={i.id}><td className="t-code">{i.codigo}</td><td className="t-desc">{i.descricao}</td><td className="t-sub">{i.unidade}</td>
                  <td className="num">{fmtNum(i.estoqueAtual)}</td><td className="num t-sub">{fmtBRL(i.custoMedio)}</td><td className="num">{fmtBRL(i.estoqueAtual * (i.custoMedio || 0))}</td><td><PillItem i={i} /></td></tr>
              ))}
              <tr><td colSpan="5" className="num t-desc">Valor total</td><td className="num t-desc">{fmtBRL(valorTotal)}</td><td /></tr>
            </tbody>
          </table>
        ))}

        {rel === "reposicao" && (baixos.length === 0 ? <div className="empty"><Ic name="check" /><p>Nenhum item no ponto de reposição.</p></div> : (
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th className="r">Atual</th><th className="r">Mínimo</th><th className="r">Sugestão de compra</th></tr></thead>
            <tbody>
              {baixos.map((i) => (
                <tr key={i.id}><td className="t-code">{i.codigo}</td><td className="t-desc">{i.descricao}</td>
                  <td className="num">{fmtNum(i.estoqueAtual)} <span className="t-sub">{i.unidade}</span></td><td className="num t-sub">{fmtNum(i.estoqueMinimo)}</td>
                  <td className="num"><span className="tag">{fmtNum(Math.max(0, i.estoqueMinimo * 2 - i.estoqueAtual))} {i.unidade}</span></td></tr>
              ))}
            </tbody>
          </table>
        ))}

        {rel === "abc" && (comValor.length === 0 ? <div className="empty"><p>Sem valor de estoque para classificar.</p></div> : (
          <table>
            <thead><tr><th>Classe</th><th>Código</th><th>Descrição</th><th className="r">Valor</th><th className="r">% total</th><th className="r">% acum.</th></tr></thead>
            <tbody>
              {(() => { let acum = 0; return comValor.map((x) => { acum += x.val; const pAc = (acum / totalABC) * 100; const cls = pAc <= 80 ? "A" : pAc <= 95 ? "B" : "C";
                return (<tr key={x.it.id}><td><span className={"abc-" + cls}>{cls}</span></td><td className="t-code">{x.it.codigo}</td><td className="t-desc">{x.it.descricao}</td>
                  <td className="num">{fmtBRL(x.val)}</td><td className="num t-sub">{((x.val / totalABC) * 100).toFixed(1)}%</td><td className="num t-sub">{pAc.toFixed(1)}%</td></tr>); }); })()}
            </tbody>
          </table>
        ))}

        {rel === "setor" && (setores.length === 0 ? <div className="empty"><p>Nenhuma requisição aprovada ainda.</p></div> : (
          <div style={{ padding: 16 }}>
            {setores.map(([s, v]) => (
              <div key={s} style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}><span className="t-desc">{s}</span><span className="mono">{fmtBRL(v)}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: Math.max(4, (v / setores[0][1]) * 100) + "%" }} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="t-sub no-print" style={{ marginTop: 10 }}>Sugestão de compra = 2× o mínimo. Na curva ABC, a classe A concentra até 80% do valor.</p>
    </div>
  );
}

/* ============ TEMA (compartilhado com a loja) ============ */
function ThemeBtn() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const toggle = () => {
    const next = dark ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("theme-anim");
    html.dataset.theme = next;
    try { localStorage.setItem("parstock.theme", next); } catch {}
    setDark(!dark);
    setTimeout(() => html.classList.remove("theme-anim"), 450);
  };
  return <button className="theme-btn" onClick={toggle} title={dark ? "Modo claro" : "Modo escuro"} aria-label="Alternar tema"><span>{dark ? "☀" : "☾"}</span></button>;
}

/* ============ MÓDULO (shell com menu lateral) ============ */
const PAGES = [
  { id: "painel", grp: "Operação", label: "Painel", icon: "dash" },
  { id: "itens", grp: "Cadastros", label: "Itens", icon: "box", full: true },
  { id: "categorias", grp: "Cadastros", label: "Categorias", icon: "tag", full: true },
  { id: "fornecedores", grp: "Cadastros", label: "Fornecedores", icon: "truck", full: true },
  { id: "entradas", grp: "Movimentação", label: "Entradas", icon: "in", full: true },
  { id: "requisicoes", grp: "Movimentação", label: "Requisições / Saídas", icon: "out" },
  { id: "ajustes", grp: "Movimentação", label: "Ajustes", icon: "adj", full: true },
  { id: "contagem", grp: "Movimentação", label: "Contagem mensal", icon: "clipboard", full: true },
  { id: "kardex", grp: "Movimentação", label: "Kardex", icon: "ledger" },
  { id: "relatorios", grp: "Análise", label: "Relatórios", icon: "report", full: true },
];

export default function AlmoxModule({ user, hotel, onExit, onLogout, openHelp, initialPage, bell, exitLabel }) {
  const [page, setPage] = useState(initialPage || "painel");
  const [pend, setPend] = useState(0);
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  useEffect(() => { almox.dashboard(hotel.id).then((d) => setPend(d.requisicoesPendentes)).catch(() => {}); }, [hotel.id, page]);
  useEffect(() => { if (initialPage) setPage(initialPage); }, [initialPage]);

  const full = canStock(user);
  const visible = PAGES.filter((p) => !p.full || full);
  const cur = PAGES.find((p) => p.id === page) || PAGES[0];
  if (cur.full && !full) { setPage("painel"); }

  const go = (id) => { setPage(id); setNavOpen(false); };

  // agrupar nav
  const groups = [];
  visible.forEach((p) => { const g = groups.find((x) => x.name === p.grp); if (g) g.pages.push(p); else groups.push({ name: p.grp, pages: [p] }); });

  return (
    <div className="almox-root">
      <style>{ALMOX_CSS}</style>
      <div className="app">
        <aside className={"sidebar" + (navOpen ? " open" : "")}>
          <div className="brand"><div className="mk">AX</div><div><h1>Almoxarifado</h1><p>{hotel.name}</p></div></div>
          <nav className="nav">
            {groups.map((g) => (
              <React.Fragment key={g.name}>
                <div className="group">{g.name}</div>
                {g.pages.map((p) => (
                  <a key={p.id} className={p.id === page ? "active" : ""} onClick={() => go(p.id)}>
                    <Ic name={p.icon} /><span>{p.label}</span>
                    {p.id === "requisicoes" && canApprove(user) && pend > 0 && <span className="badge warn">{pend}</span>}
                  </a>
                ))}
              </React.Fragment>
            ))}
          </nav>
        </aside>

        <header className="topbar">
          <button className="menu-btn no-print" onClick={() => setNavOpen(!navOpen)} aria-label="menu">☰</button>
          <div><div className="crumb">{cur.grp}</div><h2>{cur.label}</h2></div>
          <div className="spacer" />
          {bell}
          <ThemeBtn />
          <button className="help-btn no-print" onClick={openHelp} title="Ajuda / suporte">?</button>
          <div className="user-chip">
            <div className="avatar">{initials(user.name)}</div>
            <div><div className="uname">{user.name}</div><div className="urole">{rolesLabel(user)}</div></div>
            <button className="icon-btn no-print" onClick={onExit} title={exitLabel || "Trocar módulo"}><Ic name="swap" /></button>
          </div>
        </header>

        <main className="content">
          {page === "painel" && <Painel hotel={hotel} user={user} go={go} flash={flash} />}
          {page === "itens" && full && <Itens hotel={hotel} user={user} flash={flash} />}
          {page === "categorias" && full && <Categorias hotel={hotel} flash={flash} />}
          {page === "fornecedores" && full && <Fornecedores hotel={hotel} flash={flash} />}
          {page === "entradas" && full && <Entradas hotel={hotel} user={user} flash={flash} />}
          {page === "requisicoes" && <Requisicoes hotel={hotel} user={user} flash={flash} onPendChange={setPend} />}
          {page === "ajustes" && full && <Ajustes hotel={hotel} flash={flash} />}
          {page === "contagem" && full && <Contagem hotel={hotel} user={user} flash={flash} />}
          {page === "kardex" && <Kardex hotel={hotel} flash={flash} />}
          {page === "relatorios" && full && <Relatorios hotel={hotel} flash={flash} />}
        </main>

        <footer className="appfoot no-print">
          <Ic name="hotel" cls="ic-sm" /> {hotel.name}
          <span className="spacer" />
          <button className="link-btn" onClick={onLogout}>Sair</button>
          <span style={{ color: "var(--line-strong)" }}>·</span>
          Desenvolvido por <b>Rafael Almeida</b> · rafael.almeida@accor.com
        </footer>
      </div>
      {toast && <div className="toasts no-print"><div className="toast ok">{toast}</div></div>}
    </div>
  );
}
