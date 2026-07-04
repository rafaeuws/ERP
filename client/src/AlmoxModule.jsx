import React, { useState, useEffect, useMemo, useCallback } from "react";
import { almox } from "./api.js";
import { CSS } from "./App.jsx";
import * as XLSX from "xlsx";

/* ============================================================
   MÓDULO ALMOXARIFADO (ERP) — mesmo design system do Par Stock
   Painel · Requisições (aprovação) · Entradas · Itens · Kardex
   Inventário · Cadastros · Relatórios
   ============================================================ */

const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtDT = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const todayInput = () => new Date().toLocaleDateString("en-CA");
const UNIDADES = ["UN", "CX", "PCT", "KG", "G", "L", "ML", "M", "M²", "M³", "PAR", "DZ", "RL", "FD", "GL", "LATA", "SC", "FR", "KIT"];

const statusItem = (i) => (i.estoqueAtual <= 0 ? "zero" : i.estoqueAtual <= i.estoqueMinimo ? "low" : "ok");
const PillItem = ({ i }) => {
  const s = statusItem(i);
  return s === "zero" ? <span className="sbadge rej">Zerado</span> : s === "low" ? <span className="sbadge pend">Baixo</span> : <span className="sbadge ok">Normal</span>;
};
const PillReq = ({ s }) =>
  s === "pendente" ? <span className="sbadge pend">⏳ Pendente</span>
  : s === "aprovada" ? <span className="sbadge ok">✓ Aprovada</span>
  : s === "rejeitada" ? <span className="sbadge rej">✕ Rejeitada</span>
  : <span className="sbadge dim">—</span>;
const PillTipo = ({ t }) =>
  t === "entrada" ? <span className="sbadge ok">Entrada</span> : t === "saida" ? <span className="sbadge rej">Saída</span> : <span className="sbadge pend">Ajuste</span>;

const canStock = (u) => u && (u.role === "admin" || u.role === "almoxarifado");
const canApprove = canStock;

/* ---------- modal genérico ---------- */
function Modal({ title, children, onClose, onConfirm, confirmLabel = "Salvar", wide, busy, err, footExtra }) {
  return (
    <div className="modal-ov" onClick={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="fechar">×</button>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        {err && <p className="hint" style={{ color: "var(--red)" }}>{err}</p>}
        {(onConfirm || footExtra) && (
          <div className="row gap" style={{ marginTop: 14, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {footExtra}
            <button className="ghost" onClick={onClose}>Cancelar</button>
            {onConfirm && <button className="primary" disabled={busy} onClick={onConfirm}>{busy ? "Salvando…" : confirmLabel}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- editor de linhas (entradas / requisições) ---------- */
function Linhas({ linhas, setLinhas, itens, comCusto }) {
  const ativos = itens.filter((i) => i.ativo !== false);
  const up = (idx, f, v) => setLinhas(linhas.map((l, i) => (i === idx ? { ...l, [f]: v } : l)));
  const del = (idx) => setLinhas(linhas.filter((_, i) => i !== idx));
  const add = () => setLinhas([...linhas, { itemId: ativos[0] ? ativos[0].id : "", quantidade: "", custoUnitario: "" }]);
  return (
    <div style={{ marginTop: 6 }}>
      <div className={"lihead" + (comCusto ? " c4" : " c3")}>
        <div>Item</div><div>Quantidade</div><div>{comCusto ? "Custo unit. (R$)" : "Em estoque"}</div><div />
      </div>
      {linhas.map((l, idx) => {
        const it = itens.find((x) => x.id === l.itemId);
        return (
          <div className={"lirow" + (comCusto ? " c4" : " c3")} key={idx}>
            <select className="tinp" value={l.itemId} onChange={(e) => up(idx, "itemId", e.target.value)}>
              {ativos.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}
            </select>
            <input className="ninp" type="number" min="0" step="any" placeholder="qtd" value={l.quantidade}
              onChange={(e) => up(idx, "quantidade", e.target.value)} />
            {comCusto
              ? <input className="ninp" type="number" min="0" step="0.01" placeholder="0,00" value={l.custoUnitario}
                  onChange={(e) => up(idx, "custoUnitario", e.target.value)} />
              : <span className="dim mono" style={{ alignSelf: "center", fontSize: 12 }}>{it ? fmtNum(it.estoqueAtual) + " " + it.unidade : ""}</span>}
            <button className="ghost danger" onClick={() => del(idx)}>×</button>
          </div>
        );
      })}
      <button className="ghost" style={{ marginTop: 6 }} onClick={add}>+ Adicionar item</button>
    </div>
  );
}

/* ============ PAINEL ============ */
function Painel({ hotel, go, user, flash }) {
  const [d, setD] = useState(null);
  useEffect(() => { almox.dashboard(hotel.id).then(setD).catch((e) => flash(e.message)); }, [hotel.id]); // eslint-disable-line
  if (!d) return <div className="card"><div className="empty">Carregando painel…</div></div>;
  return (
    <section>
      <div className="row between wrap"><h2>Painel do almoxarifado</h2></div>
      <div className="kpis">
        <div className="kpi"><div className="kpi-n mono">{d.totalItens}</div><div className="kpi-l">itens cadastrados</div><div className="kpi-s">{d.ativos} ativos · {d.zerados} zerados</div></div>
        <div className="kpi"><div className="kpi-n mono" style={{ fontSize: 21 }}>{fmtBRL(d.valorEstoque)}</div><div className="kpi-l">valor em estoque</div><div className="kpi-s">a custo médio</div></div>
        <div className="kpi"><div className={"kpi-n mono" + (d.estoqueBaixo ? " amber" : "")}>{d.estoqueBaixo}</div><div className="kpi-l">itens no ponto de reposição</div><div className="kpi-s">no/abaixo do mínimo</div></div>
        <div className="kpi"><div className={"kpi-n mono" + (d.requisicoesPendentes ? " bad" : "")}>{d.requisicoesPendentes}</div><div className="kpi-l">requisições pendentes</div><div className="kpi-s">{canApprove(user) ? "aguardando sua aprovação" : "em análise"}</div></div>
      </div>
      {canApprove(user) && d.requisicoesPendentes > 0 && (
        <div className="card" style={{ borderColor: "var(--amber)" }}>
          <div className="row between wrap">
            <div className="card-t" style={{ margin: 0 }}>⏳ Há {d.requisicoesPendentes} requisição(ões) aguardando aprovação</div>
            <button className="primary sm" onClick={() => go("req")}>Analisar agora</button>
          </div>
        </div>
      )}
      <div className="grid2">
        <div className="card">
          <div className="row between"><div className="card-t">Alertas de reposição</div><button className="ghost" onClick={() => go("itens")}>ver itens</button></div>
          {!d.alertas.length ? <div className="empty ok">Nenhum item no ponto de reposição. ✓</div> : (
            <table className="tbl"><thead><tr><th className="tl">Item</th><th>Atual</th><th>Mínimo</th><th>Status</th></tr></thead><tbody>
              {d.alertas.map((i) => (
                <tr key={i.id}><td className="tl">{i.descricao} <span className="dim">({i.codigo})</span></td>
                  <td><span className="mono">{fmtNum(i.estoqueAtual)}</span> <span className="dim">{i.unidade}</span></td>
                  <td className="mono">{fmtNum(i.estoqueMinimo)}</td><td><PillItem i={i} /></td></tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <div className="row between"><div className="card-t">Movimentações recentes</div><button className="ghost" onClick={() => go("kardex")}>kardex</button></div>
          {!d.recentes.length ? <div className="empty">Registre uma entrada ou requisição.</div> : (
            <table className="tbl"><thead><tr><th className="tl">Data</th><th className="tl">Item</th><th>Tipo</th><th>Qtd</th></tr></thead><tbody>
              {d.recentes.map((m) => (
                <tr key={m.id}><td className="tl dim mono" style={{ fontSize: 12 }}>{fmtDate(m.data)}</td>
                  <td className="tl">{m.descricao}</td><td><PillTipo t={m.tipo} /></td>
                  <td className={"mono " + (m.tipo === "saida" ? "bad" : m.tipo === "entrada" ? "ok" : "amber")}>{m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}{fmtNum(m.quantidade)}</td></tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============ ITENS ============ */
function Itens({ hotel, user, flash }) {
  const [itens, setItens] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {mode:'new'|'edit', item}
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const podeEditar = canStock(user);

  const load = useCallback(() => {
    Promise.all([almox.itens(hotel.id), almox.categorias(hotel.id)])
      .then(([i, c]) => { setItens(i); setCats(c); })
      .catch((e) => flash(e.message));
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
      ["CN001", "Caneta esferográfica azul", "UN", 50, 200, 1.2],
      ["DT001", "Detergente neutro 5L", "GL", 4, 10, 18.9]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 10 }, { wch: 36 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Itens");
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
        if (i === 0 && Number.isNaN(min) && Number.isNaN(ini)) return; // cabeçalho
        parsed.push({ codigo, descricao, unidade: (r[2] != null ? String(r[2]).trim().toUpperCase() : "") || "UN",
          estoqueMinimo: Number.isNaN(min) ? 0 : Math.max(0, min), estoqueAtual: Number.isNaN(ini) ? 0 : Math.max(0, ini), custo: Number.isNaN(custo) ? 0 : Math.max(0, custo) });
      });
      if (!parsed.length) { alert("Não encontrei itens na planilha. Confira as colunas: A código, B descrição, C unidade, D mínimo, E estoque inicial, F custo."); return; }
      const out = await almox.importarItens(hotel.id, parsed);
      flash(`Importação: ${out.added} novo(s), ${out.updated} atualizado(s)`); load();
    } catch (e) { alert("Não foi possível importar: " + (e.message || e)); }
    finally { setImporting(false); }
  };

  if (!itens) return <div className="card"><div className="empty">Carregando itens…</div></div>;
  const list = itens.filter((i) => !q || (i.descricao + " " + i.codigo).toLowerCase().includes(q.toLowerCase()));
  const catName = (id) => (cats.find((c) => c.id === id) || {}).nome || "";

  return (
    <section>
      <div className="row between wrap">
        <h2>Itens do almoxarifado</h2>
        <div className="row gap wrap">
          <label className="fld">Buscar<input className="tinp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="código ou descrição…" /></label>
          {podeEditar && <button className="primary self-end" onClick={() => abrir(null)}>+ Novo item</button>}
        </div>
      </div>
      {podeEditar && (
        <div className="card">
          <div className="card-t">Importar do Excel</div>
          <p className="hint" style={{ margin: "0 0 10px" }}>Planilha com <b>A = código</b>, <b>B = descrição</b>, <b>C = unidade</b>, <b>D = estoque mínimo</b>, <b>E = estoque inicial</b> e <b>F = custo unitário</b>. Itens com código/descrição já existentes são atualizados (mínimo, unidade e descrição); os novos entram com o estoque inicial como movimento no Kardex.</p>
          <div className="row wrap gap">
            <label className={"primary self-end filebtn" + (importing ? " disabled" : "")}>{importing ? "Importando…" : "Importar do Excel"}
              <input type="file" accept=".xlsx,.xls,.csv" disabled={importing} style={{ display: "none" }}
                onChange={(e) => { if (e.target.files && e.target.files[0]) importarExcel(e.target.files[0]); e.target.value = ""; }} />
            </label>
            <button className="ghost self-end" onClick={baixarModelo}>Baixar modelo</button>
          </div>
        </div>
      )}
      <div className="card pad0">
        {list.length === 0 ? <div className="empty">Nenhum item {q ? "encontrado" : "cadastrado"}.</div> : (
          <div className="scrollx">
          <table className="tbl">
            <thead><tr><th className="tl">Código</th><th className="tl">Descrição</th><th>Un.</th><th>Estoque</th><th>Mínimo</th><th>Custo méd.</th><th>Status</th>{podeEditar && <th />}</tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="tl mono dim" style={{ fontSize: 12 }}>{i.codigo}</td>
                  <td className="tl">{i.descricao}{i.ativo === false && <span className="sbadge dim" style={{ marginLeft: 6 }}>inativo</span>}{i.categoriaId && <div className="dim" style={{ fontSize: 11 }}>{catName(i.categoriaId)}</div>}</td>
                  <td className="dim">{i.unidade}</td>
                  <td className="mono">{fmtNum(i.estoqueAtual)}</td>
                  <td className="mono dim">{fmtNum(i.estoqueMinimo)}</td>
                  <td className="mono dim">{fmtBRL(i.custoMedio)}</td>
                  <td><PillItem i={i} /></td>
                  {podeEditar && <td><span className="row gap" style={{ justifyContent: "center" }}>
                    <button className="ghost" onClick={() => abrir(i)}>editar</button>
                    <button className="ghost danger" onClick={() => excluir(i)}>excluir</button></span></td>}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      <p className="hint">{itens.length} itens · o saldo só muda por <b>entradas</b>, <b>requisições aprovadas</b>, <b>ajustes</b> e <b>contagens</b> — assim o Kardex conta a história completa.</p>

      {modal && (
        <Modal title={modal.mode === "new" ? "Novo item" : "Editar item"} wide onClose={() => setModal(null)} onConfirm={salvar} busy={busy} err={err}
          confirmLabel={modal.mode === "new" ? "Cadastrar" : "Salvar"}>
          <div className="row wrap gap">
            <label className="fld">Código *<input className="tinp" style={{ width: 110 }} value={f.codigo} disabled={modal.mode === "edit"} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></label>
            <label className="fld grow">Descrição *<input className="tinp full" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></label>
            <label className="fld">Unidade<select className="tinp" value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></label>
          </div>
          <div className="row wrap gap" style={{ marginTop: 8 }}>
            <label className="fld grow">Categoria<select className="tinp full" value={f.categoriaId} onChange={(e) => setF({ ...f, categoriaId: e.target.value })}>
              <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label className="fld grow">Localização<input className="tinp full" value={f.localizacao} placeholder="ex.: prateleira A3" onChange={(e) => setF({ ...f, localizacao: e.target.value })} /></label>
          </div>
          <div className="row wrap gap" style={{ marginTop: 8 }}>
            {modal.mode === "new" && <label className="fld">Estoque inicial<input className="ninp" style={{ width: 100 }} type="number" min="0" step="any" value={f.estoqueAtual} onChange={(e) => setF({ ...f, estoqueAtual: e.target.value })} /></label>}
            <label className="fld">Estoque mínimo<input className="ninp" style={{ width: 100 }} type="number" min="0" step="any" value={f.estoqueMinimo} onChange={(e) => setF({ ...f, estoqueMinimo: e.target.value })} /></label>
            {modal.mode === "new" && <label className="fld">Custo unitário (R$)<input className="ninp" style={{ width: 110 }} type="number" min="0" step="0.01" value={f.custoMedio} onChange={(e) => setF({ ...f, custoMedio: e.target.value })} /></label>}
            {modal.mode === "edit" && <label className="fld">Situação<select className="tinp" value={f.ativo ? "1" : "0"} onChange={(e) => setF({ ...f, ativo: e.target.value === "1" })}><option value="1">Ativo</option><option value="0">Inativo</option></select></label>}
          </div>
          {modal.mode === "edit" && <p className="hint">Saldo e custo médio não são editados aqui — use <b>Entradas</b>, <b>Ajustes</b> ou a <b>Contagem</b>, preservando o histórico.</p>}
        </Modal>
      )}
    </section>
  );
}

/* ============ REQUISIÇÕES ============ */
function Requisicoes({ hotel, user, flash, onPendChange }) {
  const [reqs, setReqs] = useState(null);
  const [itens, setItens] = useState([]);
  const [open, setOpen] = useState(null);       // detalhe carregado
  const [novo, setNovo] = useState(false);
  const [aprovando, setAprovando] = useState(null); // detalhe p/ aprovação
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
      .then(([r, i]) => { setReqs(r); setItens(i); onPendChange(r.filter((x) => x.status === "pendente").length); })
      .catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const abrirNovo = () => {
    if (!itens.filter((i) => i.ativo !== false).length) return flash("Cadastre itens antes de criar requisições.");
    setErr(""); setF({ requisitante: user.name, setor: "", data: todayInput(), obs: "" });
    setLinhas([{ itemId: (itens.find((i) => i.ativo !== false) || {}).id || "", quantidade: "" }]);
    setNovo(true);
  };
  const criar = async () => {
    setBusy(true); setErr("");
    try {
      const its = linhas.filter((l) => l.itemId && Number(l.quantidade) > 0).map((l) => ({ itemId: l.itemId, quantidade: Number(l.quantidade) }));
      if (!its.length) throw new Error("Adicione ao menos um item com quantidade.");
      const out = await almox.criarRequisicao(hotel.id, { ...f, itens: its });
      flash(`Requisição ${out.numero} criada — aguardando aprovação`); setNovo(false); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const ver = async (id) => { try { setOpen(await almox.requisicao(hotel.id, id)); } catch (e) { flash(e.message); } };
  const abrirAprovar = async (id) => {
    try {
      const r = await almox.requisicao(hotel.id, id);
      const ini = {}; r.itens.forEach((l) => { ini[l.linhaId] = l.quantidade; });
      setReais(ini); setObsA(""); setErr(""); setAprovando(r); setOpen(null);
    } catch (e) { flash(e.message); }
  };
  const aprovar = async () => {
    setBusy(true); setErr("");
    try {
      const body = {}; Object.keys(reais).forEach((k) => { body[k] = Number(reais[k]) || 0; });
      await almox.aprovarRequisicao(hotel.id, aprovando.id, { reais: body, obs: obsA });
      flash(`Requisição ${aprovando.numero} aprovada — estoque abatido` + (aprovando.origem === "parstock" ? ' e "Reposto" lançado no PDV' : ""));
      setAprovando(null); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const rejeitar = async () => {
    setBusy(true); setErr("");
    try { await almox.rejeitarRequisicao(hotel.id, rejeitando.id, motivo); flash(`Requisição ${rejeitando.numero} rejeitada`); setRejeitando(null); setOpen(null); load(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!reqs) return <div className="card"><div className="empty">Carregando requisições…</div></div>;
  const pend = reqs.filter((r) => r.status === "pendente").length;
  const list = filtro === "all" ? reqs : reqs.filter((r) => r.status === filtro);

  return (
    <section>
      <div className="row between wrap">
        <h2>Requisições de saída</h2>
        <button className="primary" onClick={abrirNovo}>+ Nova requisição</button>
      </div>
      {canApprove(user) && pend > 0 && (
        <div className="statusbar pend">
          <span>⏳ Há <b>{pend}</b> requisição(ões) aguardando aprovação. O estoque só é abatido ao aprovar, informando a quantidade real que saiu.</span>
        </div>
      )}
      <div className="filters">
        {[["all", "Todas"], ["pendente", "Pendentes" + (pend ? ` (${pend})` : "")], ["aprovada", "Aprovadas"], ["rejeitada", "Rejeitadas"]].map(([k, l]) => (
          <button key={k} className={"chip" + (filtro === k ? " on" : "")} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      <div className="card pad0">
        {list.length === 0 ? <div className="empty">Nenhuma requisição {filtro !== "all" ? "neste filtro" : "— atendentes e a loja (Par Stock) criam requisições; o almoxarifado aprova e o saldo é abatido"}.</div> : (
          <div className="scrollx">
          <table className="tbl">
            <thead><tr><th className="tl">Nº</th><th>Data</th><th>Status</th><th className="tl">Origem</th><th className="tl">Solicitante</th><th>Itens</th><th>Valor</th><th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="tl mono">{r.numero}</td>
                  <td className="mono dim" style={{ fontSize: 12 }}>{fmtDate(r.data)}</td>
                  <td><PillReq s={r.status} /></td>
                  <td className="tl">{r.origem === "parstock" ? <span className="sbadge loja">🏪 {r.setor || "Loja"}</span> : <span className="dim">{r.setor || "—"}</span>}</td>
                  <td className="tl">{r.requisitante || "—"}</td>
                  <td className="mono">{r.qtdItens}</td>
                  <td className="mono dim">{fmtBRL(r.valor)}</td>
                  <td><span className="row gap" style={{ justifyContent: "center" }}>
                    <button className="ghost" onClick={() => ver(r.id)}>ver</button>
                    {r.status === "pendente" && canApprove(user) && (<>
                      <button className="primary sm" onClick={() => abrirAprovar(r.id)}>aprovar</button>
                      <button className="ghost danger" onClick={() => { setMotivo(""); setErr(""); setRejeitando(r); }}>rejeitar</button>
                    </>)}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ---- detalhe / impressão ---- */}
      {open && (
        <Modal title={"Requisição " + open.numero} wide onClose={() => setOpen(null)}
          footExtra={<>
            <button className="ghost" onClick={() => window.print()}>Imprimir (com assinaturas)</button>
            {open.status === "pendente" && canApprove(user) && <button className="primary" onClick={() => abrirAprovar(open.id)}>Aprovar…</button>}
          </>}>
          <div className="print-zone">
            <div className="printhead" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <div className="stamp sm">ALMOX<br />ERP</div>
              <div>
                <div className="ph-t">REQUISIÇÃO {open.numero} — {hotel.name}</div>
                <div className="ph-s">{fmtDT(open.data)} · Solicitante: {open.requisitante || "—"} · Setor: {open.setor || "—"}{open.pdvName ? " · Origem: reposição do PDV " + open.pdvName + (open.diaData ? " (" + open.diaData.split("-").reverse().join("/") + ")" : "") : ""}</div>
              </div>
            </div>
            <div className="row gap wrap no-print" style={{ margin: "8px 0" }}>
              <PillReq s={open.status} />
              {open.aprovadoPor && <span className="dim" style={{ fontSize: 12 }}>{open.status === "rejeitada" ? "Rejeitada" : "Aprovada"} por <b>{open.aprovadoPor}</b> em {fmtDT(open.aprovadoEm)}</span>}
            </div>
            <table className="tbl">
              <thead><tr><th className="tl">Item</th><th>Un.</th><th>Solicitado</th><th>Qtd real</th><th>Custo méd.</th><th>Total</th></tr></thead>
              <tbody>
                {open.itens.map((l) => {
                  const aprovada = open.status === "aprovada";
                  const base = aprovada && l.quantidadeReal != null ? l.quantidadeReal : l.quantidade;
                  const div = aprovada && l.quantidadeReal != null && l.quantidadeReal !== l.quantidade;
                  return (
                    <tr key={l.linhaId}>
                      <td className="tl">{l.descricao}</td><td className="dim">{l.unidade}</td>
                      <td className="mono">{fmtNum(l.quantidade)}</td>
                      <td>{aprovada ? <span className={"mono" + (div ? " bad" : "")}>{fmtNum(l.quantidadeReal != null ? l.quantidadeReal : l.quantidade)}</span> : <span className="dim">—</span>}</td>
                      <td className="mono dim">{fmtBRL(l.custoUnitario)}</td>
                      <td className="mono">{fmtBRL(base * (l.custoUnitario || 0))}</td>
                    </tr>
                  );
                })}
                <tr className="totrow"><td className="tl">Total</td><td /><td /><td /><td /><td className="mono">{fmtBRL(open.itens.reduce((s, l) => s + (open.status === "aprovada" && l.quantidadeReal != null ? l.quantidadeReal : l.quantidade) * (l.custoUnitario || 0), 0))}</td></tr>
              </tbody>
            </table>
            {open.obs && <p className="hint" style={{ marginTop: 8 }}>{open.obs}</p>}
            <div className="signrow">
              <div className="signbox"><div className="signline" /><div className="signlabel">Responsável pela requisição</div></div>
              <div className="signbox"><div className="signline" /><div className="signlabel">Visto do subgerente</div></div>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- nova requisição ---- */}
      {novo && (
        <Modal title="Nova requisição de saída" wide onClose={() => setNovo(false)} onConfirm={criar} busy={busy} err={err} confirmLabel="Enviar para aprovação">
          <div className="row wrap gap">
            <label className="fld grow">Solicitante *<input className="tinp full" value={f.requisitante} onChange={(e) => setF({ ...f, requisitante: e.target.value })} /></label>
            <label className="fld grow">Setor / centro de custo<input className="tinp full" value={f.setor} placeholder="ex.: Manutenção" onChange={(e) => setF({ ...f, setor: e.target.value })} /></label>
            <label className="fld">Data<input className="dinp" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></label>
          </div>
          <Linhas linhas={linhas} setLinhas={setLinhas} itens={itens} />
          <label className="fld block" style={{ marginTop: 12 }}>Observação<input className="tinp full" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></label>
          <p className="hint">A requisição entra como <b>pendente</b>. O estoque só é abatido quando o almoxarifado (ou admin) aprovar.</p>
        </Modal>
      )}

      {/* ---- aprovação ---- */}
      {aprovando && (
        <Modal title={"Aprovar " + aprovando.numero} wide onClose={() => setAprovando(null)} onConfirm={aprovar} busy={busy} err={err} confirmLabel="Aprovar e abater estoque">
          {aprovando.origem === "parstock" && (
            <div className="statusbar ok" style={{ marginBottom: 10 }}>
              <span>🏪 Reposição do PDV <b>{aprovando.pdvName || ""}</b>{aprovando.diaData ? " · dia " + aprovando.diaData.split("-").reverse().join("/") : ""}. Ao aprovar, a quantidade real é lançada automaticamente como <b>Reposto</b> na conciliação da loja.</span>
            </div>
          )}
          <p className="hint" style={{ marginTop: 0 }}>Confira e informe a <b>quantidade real</b> que saiu de cada item. Divergências ficam registradas.</p>
          <table className="tbl">
            <thead><tr><th className="tl">Item</th><th>Solicitado</th><th>Em estoque</th><th>Qtd. real</th></tr></thead>
            <tbody>
              {aprovando.itens.map((l) => (
                <tr key={l.linhaId}>
                  <td className="tl">{l.descricao} <span className="dim">({l.unidade})</span></td>
                  <td className="mono">{fmtNum(l.quantidade)}</td>
                  <td className={"mono" + (l.estoqueAtual != null && l.estoqueAtual < l.quantidade ? " bad" : " dim")}>{l.estoqueAtual == null ? "—" : fmtNum(l.estoqueAtual)}</td>
                  <td><input className="ninp" style={{ width: 90 }} type="number" min="0" step="any" value={reais[l.linhaId] ?? ""} onChange={(e) => setReais({ ...reais, [l.linhaId]: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="fld block" style={{ marginTop: 12 }}>Observação da aprovação<input className="tinp full" value={obsA} placeholder="opcional" onChange={(e) => setObsA(e.target.value)} /></label>
        </Modal>
      )}

      {/* ---- rejeição ---- */}
      {rejeitando && (
        <Modal title={"Rejeitar " + rejeitando.numero} onClose={() => setRejeitando(null)} onConfirm={rejeitar} busy={busy} err={err} confirmLabel="Rejeitar">
          <p className="hint" style={{ marginTop: 0 }}>Nenhum estoque será movimentado. Quem criou a requisição será notificado com o motivo.</p>
          <label className="fld block">Motivo<input className="tinp full" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        </Modal>
      )}
    </section>
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
      .then(([e, i, fo]) => { setEntradas(e); setItens(i); setForns(fo); })
      .catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const abrir = () => {
    if (!itens.length) return flash("Cadastre itens antes de registrar entradas.");
    setErr(""); setF({ fornecedorId: "", notaFiscal: "", data: todayInput(), obs: "" });
    setLinhas([{ itemId: (itens.find((i) => i.ativo !== false) || {}).id || "", quantidade: "", custoUnitario: "" }]);
    setNovo(true);
  };
  const salvar = async () => {
    setBusy(true); setErr("");
    try {
      const its = linhas.filter((l) => l.itemId && Number(l.quantidade) > 0)
        .map((l) => ({ itemId: l.itemId, quantidade: Number(l.quantidade), custoUnitario: Number(l.custoUnitario) || 0 }));
      if (!its.length) throw new Error("Adicione ao menos um item com quantidade.");
      const out = await almox.criarEntrada(hotel.id, { ...f, itens: its });
      flash(`Entrada ${out.numero} registrada — estoque atualizado`); setNovo(false); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!entradas) return <div className="card"><div className="empty">Carregando entradas…</div></div>;
  return (
    <section>
      <div className="row between wrap">
        <h2>Entradas de material</h2>
        {canStock(user) && <button className="primary" onClick={abrir}>+ Nova entrada</button>}
      </div>
      <div className="card pad0">
        {entradas.length === 0 ? <div className="empty">Nenhuma entrada registrada. As entradas alimentam o estoque e o custo médio.</div> : (
          <table className="tbl">
            <thead><tr><th className="tl">Nº</th><th>Data</th><th className="tl">Fornecedor</th><th className="tl">NF</th><th>Itens</th></tr></thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id}>
                  <td className="tl mono">{e.numero}</td>
                  <td className="mono dim" style={{ fontSize: 12 }}>{fmtDate(e.data)}</td>
                  <td className="tl">{e.fornecedorNome || "—"}</td>
                  <td className="tl dim">{e.notaFiscal || "—"}</td>
                  <td className="mono">{e.qtdItens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {novo && (
        <Modal title="Nova entrada" wide onClose={() => setNovo(false)} onConfirm={salvar} busy={busy} err={err} confirmLabel="Registrar entrada">
          <div className="row wrap gap">
            <label className="fld grow">Fornecedor<select className="tinp full" value={f.fornecedorId} onChange={(e) => setF({ ...f, fornecedorId: e.target.value })}>
              <option value="">—</option>{forns.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
            <label className="fld grow">Nota fiscal<input className="tinp full" value={f.notaFiscal} onChange={(e) => setF({ ...f, notaFiscal: e.target.value })} /></label>
            <label className="fld">Data<input className="dinp" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></label>
          </div>
          <Linhas linhas={linhas} setLinhas={setLinhas} itens={itens} comCusto />
          <label className="fld block" style={{ marginTop: 12 }}>Observação<input className="tinp full" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></label>
          <p className="hint">O custo unitário informado recalcula o <b>custo médio ponderado</b> de cada item.</p>
        </Modal>
      )}
    </section>
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
    if (itemId) q.push("itemId=" + itemId);
    if (de) q.push("de=" + de);
    if (ate) q.push("ate=" + ate);
    almox.movimentacoes(hotel.id, q.length ? "?" + q.join("&") : "").then(setMovs).catch((e) => flash(e.message));
  }, [hotel.id, itemId, de, ate]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { almox.itens(hotel.id).then(setItens).catch(() => {}); }, [hotel.id]); // eslint-disable-line

  return (
    <section>
      <div className="row between wrap no-print">
        <h2>Kardex — movimentações</h2>
        <button className="primary" onClick={() => window.print()}>Imprimir</button>
      </div>
      <div className="card no-print">
        <div className="row wrap gap">
          <label className="fld grow">Item<select className="tinp full" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Todos os itens</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}</select></label>
          <label className="fld">De<input className="dinp" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label className="fld">Até<input className="dinp" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        </div>
      </div>
      <div className="card pad0 print-zone">
        <div className="printhead">
          <div className="stamp sm">ALMOX<br />ERP</div>
          <div><div className="ph-t">KARDEX — {hotel.name}</div><div className="ph-s">{de || ate ? `Período: ${de ? de.split("-").reverse().join("/") : "…"} a ${ate ? ate.split("-").reverse().join("/") : "…"}` : "Últimas movimentações"}</div></div>
        </div>
        {!movs ? <div className="empty">Carregando…</div> : movs.length === 0 ? <div className="empty">Sem movimentações no filtro.</div> : (
          <div className="scrollx">
          <table className="tbl">
            <thead><tr><th className="tl">Data</th><th className="tl">Item</th><th>Tipo</th><th>Qtd</th><th>Custo unit.</th><th>Saldo</th><th className="tl">Documento</th><th className="tl">Origem</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="tl mono dim" style={{ fontSize: 12 }}>{fmtDT(m.data)}</td>
                  <td className="tl">{m.itemDescricao} <span className="dim" style={{ fontSize: 11 }}>({m.itemCodigo})</span></td>
                  <td><PillTipo t={m.tipo} /></td>
                  <td className={"mono " + (m.tipo === "saida" ? "bad" : m.tipo === "entrada" ? "ok" : "amber")}>{m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}{fmtNum(m.quantidade)}</td>
                  <td className="mono dim">{fmtBRL(m.custoUnitario)}</td>
                  <td className="mono">{fmtNum(m.saldoApos)}</td>
                  <td className="tl mono dim" style={{ fontSize: 12 }}>{m.documento || "—"}</td>
                  <td className="tl dim" style={{ fontSize: 12 }}>{m.origem || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============ INVENTÁRIO (ajuste rápido + contagem geral) ============ */
function Inventario({ hotel, user, flash }) {
  const [itens, setItens] = useState([]);
  const [contagens, setContagens] = useState(null);
  const [folha, setFolha] = useState(null);       // { resp, valores: {itemId: contado} }
  const [verCont, setVerCont] = useState(null);
  const [aj, setAj] = useState({ itemId: "", novoSaldo: "", obs: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([almox.itens(hotel.id), almox.contagens(hotel.id)])
      .then(([i, c]) => { setItens(i); setContagens(c); if (!aj.itemId && i.length) setAj((p) => ({ ...p, itemId: i[0].id, novoSaldo: i[0].estoqueAtual })); })
      .catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const salvarAjuste = async () => {
    if (!aj.itemId) return;
    setBusy(true);
    try { await almox.ajuste(hotel.id, aj); flash("Ajuste registrado no Kardex"); setAj({ ...aj, obs: "" }); load(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };
  const iniciar = () => {
    const valores = {}; itens.filter((i) => i.ativo !== false).forEach((i) => { valores[i.id] = i.estoqueAtual; });
    setFolha({ resp: user.name, valores });
  };
  const finalizar = async () => {
    const ativos = itens.filter((i) => i.ativo !== false);
    const its = ativos.map((i) => ({ itemId: i.id, contado: Number(folha.valores[i.id]) }));
    const divergentes = ativos.filter((i) => Number(folha.valores[i.id]) !== i.estoqueAtual).length;
    if (!window.confirm(divergentes
      ? `Finalizar com ${divergentes} divergência(s)? Os saldos serão ajustados para o valor contado, gerando movimentações no Kardex.`
      : "Nenhuma divergência encontrada. Registrar a contagem?")) return;
    setBusy(true);
    try {
      const out = await almox.criarContagem(hotel.id, { responsavel: folha.resp, itens: its });
      flash(`Contagem ${out.numero} finalizada — ${out.ajustes} ajuste(s)`); setFolha(null); load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  const itemSel = itens.find((i) => i.id === aj.itemId);
  const ativos = itens.filter((i) => i.ativo !== false).slice().sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));

  if (folha) {
    return (
      <section>
        <div className="row between wrap no-print">
          <h2>Folha de contagem</h2>
          <div className="row gap">
            <button className="ghost" onClick={() => window.print()}>Imprimir em branco</button>
            <button className="ghost" onClick={() => setFolha(null)}>Cancelar</button>
            <button className="primary" disabled={busy} onClick={finalizar}>{busy ? "Finalizando…" : "Finalizar e ajustar"}</button>
          </div>
        </div>
        <div className="card no-print">
          <label className="fld" style={{ maxWidth: 320 }}>Responsável pela contagem<input className="tinp full" value={folha.resp} onChange={(e) => setFolha({ ...folha, resp: e.target.value })} /></label>
        </div>
        <div className="card pad0 print-zone">
          <div className="printhead">
            <div className="stamp sm">ALMOX<br />ERP</div>
            <div><div className="ph-t">CONTAGEM DE INVENTÁRIO — {hotel.name}</div><div className="ph-s">Data: {fmtDate(new Date().toISOString())} · Responsável: {folha.resp || "____________________"}</div></div>
          </div>
          <table className="tbl">
            <thead><tr><th className="tl">Código</th><th className="tl">Descrição</th><th>Un.</th><th>Sistema</th><th>Contagem</th><th className="no-print">Diverg.</th></tr></thead>
            <tbody>
              {ativos.map((i) => {
                const v = folha.valores[i.id];
                const dv = (Number(v) || 0) - i.estoqueAtual;
                return (
                  <tr key={i.id}>
                    <td className="tl mono dim" style={{ fontSize: 12 }}>{i.codigo}</td>
                    <td className="tl">{i.descricao}</td>
                    <td className="dim">{i.unidade}</td>
                    <td className="mono">{fmtNum(i.estoqueAtual)}</td>
                    <td><span className="no-print"><input className="ninp" style={{ width: 84 }} type="number" min="0" step="any" value={v}
                      onChange={(e) => setFolha({ ...folha, valores: { ...folha.valores, [i.id]: e.target.value } })} /></span><span className="only-print cline" /></td>
                    <td className="no-print">{dv === 0 ? <span className="dim mono">0</span> : dv > 0 ? <span className="mono ok">+{fmtNum(dv)}</span> : <span className="mono bad">{fmtNum(dv)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint no-print">Ao finalizar, as divergências geram <b>ajustes automáticos</b> registrados no Kardex com o número da contagem.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="row between wrap"><h2>Inventário</h2></div>
      <div className="grid2">
        <div className="card">
          <div className="card-t">Contagem geral</div>
          <p className="hint" style={{ margin: "0 0 12px" }}>Conte fisicamente todos os itens ativos. O sistema mostra o saldo atual ao lado e, ao finalizar, as divergências viram ajustes automáticos no Kardex.</p>
          <button className="primary" onClick={iniciar} disabled={!ativos.length}>Iniciar nova contagem</button>
          {!ativos.length && <p className="hint">Cadastre itens ativos para contar.</p>}
        </div>
        <div className="card">
          <div className="card-t">Ajuste pontual</div>
          <label className="fld block">Item<select className="tinp full" value={aj.itemId} onChange={(e) => { const it = itens.find((i) => i.id === e.target.value); setAj({ ...aj, itemId: e.target.value, novoSaldo: it ? it.estoqueAtual : "" }); }}>
            {itens.map((i) => <option key={i.id} value={i.id}>{i.codigo} — {i.descricao}</option>)}</select></label>
          <div className="row wrap gap">
            <label className="fld">Saldo no sistema<input className="tinp" style={{ width: 130 }} disabled value={itemSel ? fmtNum(itemSel.estoqueAtual) + " " + itemSel.unidade : ""} /></label>
            <label className="fld">Novo saldo (real)<input className="ninp" style={{ width: 110 }} type="number" min="0" step="any" value={aj.novoSaldo} onChange={(e) => setAj({ ...aj, novoSaldo: e.target.value })} /></label>
          </div>
          <label className="fld block" style={{ marginTop: 8 }}>Observação<input className="tinp full" value={aj.obs} onChange={(e) => setAj({ ...aj, obs: e.target.value })} /></label>
          <button className="primary" style={{ marginTop: 10 }} disabled={busy || !aj.itemId} onClick={salvarAjuste}>Registrar ajuste</button>
        </div>
      </div>
      <div className="card pad0">
        <div style={{ padding: "12px 14px 0" }}><div className="card-t">Contagens anteriores</div></div>
        {!contagens ? <div className="empty">Carregando…</div> : contagens.length === 0 ? <div className="empty">Nenhuma contagem registrada ainda.</div> : (
          <table className="tbl">
            <thead><tr><th className="tl">Nº</th><th>Data</th><th className="tl">Responsável</th><th>Itens</th><th>Divergências</th><th /></tr></thead>
            <tbody>
              {contagens.map((c) => (
                <tr key={c.id}>
                  <td className="tl mono">{c.numero}</td>
                  <td className="mono dim" style={{ fontSize: 12 }}>{fmtDT(c.data)}</td>
                  <td className="tl">{c.responsavel || "—"}</td>
                  <td className="mono">{c.qtdItens}</td>
                  <td>{c.ajustes ? <span className="sbadge pend">{c.ajustes}</span> : <span className="sbadge ok">0</span>}</td>
                  <td><button className="ghost" onClick={async () => { try { setVerCont(await almox.contagem(hotel.id, c.id)); } catch (e) { flash(e.message); } }}>ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {verCont && (
        <Modal title={"Contagem " + verCont.numero} wide onClose={() => setVerCont(null)}>
          <p className="hint" style={{ marginTop: 0 }}>{fmtDT(verCont.data)} · Responsável: {verCont.responsavel || "—"} · {verCont.ajustes} ajuste(s) aplicado(s)</p>
          <table className="tbl">
            <thead><tr><th className="tl">Item</th><th>Sistema</th><th>Contado</th><th>Diverg.</th></tr></thead>
            <tbody>
              {verCont.itens.map((l, i) => (
                <tr key={i}><td className="tl">{l.descricao}</td><td className="mono dim">{fmtNum(l.sistema)}</td><td className="mono">{fmtNum(l.contado)}</td>
                  <td>{l.diverg === 0 ? <span className="dim mono">0</span> : l.diverg > 0 ? <span className="mono ok">+{fmtNum(l.diverg)}</span> : <span className="mono bad">{fmtNum(l.diverg)}</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </section>
  );
}

/* ============ CADASTROS (categorias + fornecedores) ============ */
function Cadastros({ hotel, flash }) {
  const [cats, setCats] = useState([]);
  const [forns, setForns] = useState([]);
  const [novaCat, setNovaCat] = useState("");
  const [fmodal, setFmodal] = useState(null); // {mode, forn}
  const [ff, setFf] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([almox.categorias(hotel.id), almox.fornecedores(hotel.id)])
      .then(([c, f]) => { setCats(c); setForns(f); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const addCat = async () => { if (!novaCat.trim()) return; try { await almox.criarCategoria(hotel.id, novaCat.trim()); setNovaCat(""); load(); } catch (e) { alert(e.message); } };
  const renCat = async (c) => { const n = window.prompt("Novo nome da categoria:", c.nome); if (n && n.trim()) { try { await almox.editarCategoria(hotel.id, c.id, n.trim()); load(); } catch (e) { alert(e.message); } } };
  const delCat = async (c) => { if (window.confirm(`Excluir a categoria "${c.nome}"? Os itens dela ficam sem categoria.`)) { try { await almox.excluirCategoria(hotel.id, c.id); load(); } catch (e) { alert(e.message); } } };

  const abrirForn = (forn) => { setErr(""); setFf(forn ? { ...forn } : { nome: "", cnpj: "", contato: "", telefone: "", email: "" }); setFmodal(forn ? { mode: "edit", forn } : { mode: "new" }); };
  const salvarForn = async () => {
    setBusy(true); setErr("");
    try {
      if (fmodal.mode === "new") await almox.criarFornecedor(hotel.id, ff);
      else await almox.editarFornecedor(hotel.id, fmodal.forn.id, ff);
      flash("Fornecedor salvo"); setFmodal(null); load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const delForn = async (f) => { if (window.confirm(`Excluir o fornecedor "${f.nome}"?`)) { try { await almox.excluirFornecedor(hotel.id, f.id); load(); } catch (e) { alert(e.message); } } };

  return (
    <section>
      <div className="row between wrap"><h2>Cadastros</h2></div>
      <div className="grid2">
        <div className="card">
          <div className="card-t">Categorias</div>
          <div className="row gap" style={{ marginBottom: 10 }}>
            <input className="tinp grow" value={novaCat} placeholder="nova categoria…" onChange={(e) => setNovaCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
            <button className="primary" onClick={addCat}>Adicionar</button>
          </div>
          {cats.length === 0 ? <div className="empty">Nenhuma categoria.</div> : cats.map((c) => (
            <div className="pdvitem" key={c.id} style={{ padding: "8px 12px" }}>
              <div className="grow">{c.nome}</div>
              <button className="ghost" onClick={() => renCat(c)}>renomear</button>
              <button className="ghost danger" onClick={() => delCat(c)}>excluir</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row between"><div className="card-t">Fornecedores</div><button className="primary sm" onClick={() => abrirForn(null)}>+ Novo</button></div>
          {forns.length === 0 ? <div className="empty">Nenhum fornecedor.</div> : forns.map((f) => (
            <div className="pdvitem" key={f.id} style={{ padding: "8px 12px" }}>
              <div className="grow"><div>{f.nome}</div><div className="dim" style={{ fontSize: 11 }}>{[f.cnpj, f.contato, f.telefone].filter(Boolean).join(" · ") || "—"}</div></div>
              <button className="ghost" onClick={() => abrirForn(f)}>editar</button>
              <button className="ghost danger" onClick={() => delForn(f)}>excluir</button>
            </div>
          ))}
        </div>
      </div>
      {fmodal && (
        <Modal title={fmodal.mode === "new" ? "Novo fornecedor" : "Editar fornecedor"} wide onClose={() => setFmodal(null)} onConfirm={salvarForn} busy={busy} err={err}>
          <label className="fld block">Nome *<input className="tinp full" value={ff.nome} onChange={(e) => setFf({ ...ff, nome: e.target.value })} /></label>
          <div className="row wrap gap">
            <label className="fld grow">CNPJ<input className="tinp full" value={ff.cnpj} onChange={(e) => setFf({ ...ff, cnpj: e.target.value })} /></label>
            <label className="fld grow">Telefone<input className="tinp full" value={ff.telefone} onChange={(e) => setFf({ ...ff, telefone: e.target.value })} /></label>
          </div>
          <div className="row wrap gap" style={{ marginTop: 8 }}>
            <label className="fld grow">Contato<input className="tinp full" value={ff.contato} onChange={(e) => setFf({ ...ff, contato: e.target.value })} /></label>
            <label className="fld grow">E-mail<input className="tinp full" value={ff.email} onChange={(e) => setFf({ ...ff, email: e.target.value })} /></label>
          </div>
        </Modal>
      )}
    </section>
  );
}

/* ============ RELATÓRIOS ============ */
function Relatorios({ hotel, flash }) {
  const [itens, setItens] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [rel, setRel] = useState("posicao");
  useEffect(() => {
    Promise.all([almox.itens(hotel.id), almox.requisicoes(hotel.id)])
      .then(([i, r]) => { setItens(i); setReqs(r); }).catch((e) => flash(e.message));
  }, [hotel.id]); // eslint-disable-line

  if (!itens) return <div className="card"><div className="empty">Carregando relatórios…</div></div>;

  const valorTotal = itens.reduce((s, i) => s + i.estoqueAtual * (i.custoMedio || 0), 0);
  const baixos = itens.filter((i) => i.ativo !== false && i.estoqueAtual <= i.estoqueMinimo);
  const comValor = itens.filter((i) => i.estoqueAtual * (i.custoMedio || 0) > 0)
    .map((i) => ({ it: i, val: i.estoqueAtual * (i.custoMedio || 0) })).sort((a, b) => b.val - a.val);
  const totalABC = comValor.reduce((s, x) => s + x.val, 0) || 1;
  const porSetor = {};
  reqs.filter((r) => r.status === "aprovada").forEach((r) => { const k = r.setor || "(sem setor)"; porSetor[k] = (porSetor[k] || 0) + (r.valor || 0); });
  const setores = Object.entries(porSetor).sort((a, b) => b[1] - a[1]);

  const RELS = [["posicao", "Posição de estoque"], ["reposicao", "Itens para reposição"], ["abc", "Curva ABC"], ["setor", "Consumo por setor"]];
  const titulo = (RELS.find(([k]) => k === rel) || [])[1];

  return (
    <section>
      <div className="row between wrap no-print">
        <h2>Relatórios</h2>
        <button className="primary" onClick={() => window.print()}>Imprimir relatório</button>
      </div>
      <div className="filters no-print">
        {RELS.map(([k, l]) => <button key={k} className={"chip" + (rel === k ? " on" : "")} onClick={() => setRel(k)}>{l}</button>)}
      </div>
      <div className="card pad0 print-zone">
        <div className="printhead">
          <div className="stamp sm">ALMOX<br />ERP</div>
          <div><div className="ph-t">{(titulo || "").toUpperCase()} — {hotel.name}</div><div className="ph-s">Emitido em {new Date().toLocaleString("pt-BR")}</div></div>
        </div>
        {rel === "posicao" && (itens.length === 0 ? <div className="empty">Sem itens cadastrados.</div> : (
          <table className="tbl">
            <thead><tr><th className="tl">Código</th><th className="tl">Descrição</th><th>Un.</th><th>Saldo</th><th>Custo méd.</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {itens.slice().sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")).map((i) => (
                <tr key={i.id}><td className="tl mono dim" style={{ fontSize: 12 }}>{i.codigo}</td><td className="tl">{i.descricao}</td><td className="dim">{i.unidade}</td>
                  <td className="mono">{fmtNum(i.estoqueAtual)}</td><td className="mono dim">{fmtBRL(i.custoMedio)}</td><td className="mono">{fmtBRL(i.estoqueAtual * (i.custoMedio || 0))}</td><td><PillItem i={i} /></td></tr>
              ))}
              <tr className="totrow"><td className="tl">Valor total</td><td /><td /><td /><td /><td className="mono">{fmtBRL(valorTotal)}</td><td /></tr>
            </tbody>
          </table>
        ))}
        {rel === "reposicao" && (baixos.length === 0 ? <div className="empty ok">Nenhum item no ponto de reposição. ✓</div> : (
          <table className="tbl">
            <thead><tr><th className="tl">Código</th><th className="tl">Descrição</th><th>Atual</th><th>Mínimo</th><th>Sugestão de compra</th></tr></thead>
            <tbody>
              {baixos.map((i) => (
                <tr key={i.id}><td className="tl mono dim" style={{ fontSize: 12 }}>{i.codigo}</td><td className="tl">{i.descricao}</td>
                  <td className="mono">{fmtNum(i.estoqueAtual)} <span className="dim">{i.unidade}</span></td><td className="mono dim">{fmtNum(i.estoqueMinimo)}</td>
                  <td><Tagish>{fmtNum(Math.max(0, i.estoqueMinimo * 2 - i.estoqueAtual))} {i.unidade}</Tagish></td></tr>
              ))}
            </tbody>
          </table>
        ))}
        {rel === "abc" && (comValor.length === 0 ? <div className="empty">Sem valor de estoque para classificar.</div> : (
          <table className="tbl">
            <thead><tr><th>Classe</th><th className="tl">Código</th><th className="tl">Descrição</th><th>Valor</th><th>% total</th><th>% acum.</th></tr></thead>
            <tbody>
              {(() => { let acum = 0; return comValor.map((x) => {
                acum += x.val; const pAc = (acum / totalABC) * 100; const cls = pAc <= 80 ? "A" : pAc <= 95 ? "B" : "C";
                return (
                  <tr key={x.it.id}>
                    <td><span className={"sbadge " + (cls === "A" ? "rej" : cls === "B" ? "pend" : "ok")}>{cls}</span></td>
                    <td className="tl mono dim" style={{ fontSize: 12 }}>{x.it.codigo}</td><td className="tl">{x.it.descricao}</td>
                    <td className="mono">{fmtBRL(x.val)}</td><td className="mono dim">{((x.val / totalABC) * 100).toFixed(1)}%</td><td className="mono dim">{pAc.toFixed(1)}%</td>
                  </tr>
                ); }); })()}
            </tbody>
          </table>
        ))}
        {rel === "setor" && (setores.length === 0 ? <div className="empty">Nenhuma requisição aprovada ainda.</div> : (
          <div style={{ padding: 14 }}>
            {setores.map(([s, v]) => (
              <div className="rank" key={s}>
                <span className="rank-n">{s}</span>
                <span className="rank-bar"><i style={{ width: Math.max(6, (v / setores[0][1]) * 100) + "%" }} /></span>
                <span className="rank-v2 mono">{fmtBRL(v)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="hint no-print">A <b>sugestão de compra</b> considera 2× o estoque mínimo. Na curva ABC, a classe A concentra até 80% do valor.</p>
    </section>
  );
}
const Tagish = ({ children }) => <span className="tag tag-a">{children}</span>;

/* ============ MÓDULO (shell com abas) ============ */
export default function AlmoxModule({ user, hotel, onExit, onLogout, openHelp, initialPage, bell, exitLabel }) {
  const [tab, setTab] = useState(initialPage || "painel");
  const [pend, setPend] = useState(0);
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    almox.dashboard(hotel.id).then((d) => setPend(d.requisicoesPendentes)).catch(() => {});
  }, [hotel.id, tab]);
  useEffect(() => { if (initialPage) setTab(initialPage); }, [initialPage]);

  const full = canStock(user);
  const TABS = [
    ["painel", "Painel"], ["req", "Requisições"],
    ...(full ? [["ent", "Entradas"], ["itens", "Itens"]] : []),
    ["kardex", "Kardex"],
    ...(full ? [["inv", "Inventário"], ["cad", "Cadastros"], ["rel", "Relatórios"]] : []),
  ];

  return (
    <div className="app">
      <style>{CSS}</style>
      <header className="hdr no-print">
        <div className="hdr-in">
          <div className="hdr-top">
            <div className="brand">
              <div className="stamp">ALMOX<br />ERP</div>
              <div>
                <div className="brand-t">{hotel.name}</div>
                <div className="pdv-title">Almoxarifado</div>
              </div>
            </div>
            <div className="hdr-actions">
              {bell}
              <div className="who"><span className="who-n">{user.name}</span><span className="who-r">{user.role === "admin" ? "Administrador" : user.role === "almoxarifado" ? "Almoxarifado" : "Atendente"}</span></div>
              <button className="switchbtn" onClick={onExit}>{exitLabel || "Trocar módulo"}</button>
              <button className="switchbtn" onClick={onLogout}>Sair</button>
              <button className="helpbtn" onClick={openHelp} title="Dúvidas e suporte">?</button>
            </div>
          </div>
          <nav className="tabs">
            {TABS.map(([k, l]) => (
              <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
                {l}{k === "req" && pend > 0 ? <span className="tabdot" /> : null}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        {tab === "painel" && <Painel hotel={hotel} user={user} go={setTab} flash={flash} />}
        {tab === "req" && <Requisicoes hotel={hotel} user={user} flash={flash} onPendChange={setPend} />}
        {tab === "ent" && full && <Entradas hotel={hotel} user={user} flash={flash} />}
        {tab === "itens" && full && <Itens hotel={hotel} user={user} flash={flash} />}
        {tab === "kardex" && <Kardex hotel={hotel} flash={flash} />}
        {tab === "inv" && full && <Inventario hotel={hotel} user={user} flash={flash} />}
        {tab === "cad" && full && <Cadastros hotel={hotel} flash={flash} />}
        {tab === "rel" && full && <Relatorios hotel={hotel} flash={flash} />}
      </main>
      <footer className="foot no-print">Desenvolvido por <b>Rafael Almeida</b> · <a href="mailto:rafael.almeida@accor.com">rafael.almeida@accor.com</a></footer>
      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  );
}
