import { Router } from "express";
import { db, newId, nowISO } from "../db.js";
import { authRequired } from "../auth.js";
import { userRow, userHasHotel, canApprove, canStock } from "../helpers.js";
import { notify } from "./notif.js";

const r = Router();
r.use(authRequired);

/* ============ guarda de acesso ao hotel ============ */
async function hotelGuard(req, res, next) {
  try {
    const user = await userRow(req.auth.id);
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    const hotel = await db.get("SELECT * FROM hotels WHERE id = ?", [req.params.hid]);
    if (!hotel) return res.status(404).json({ error: "Hotel não encontrado." });
    if (!userHasHotel(user, hotel.id)) return res.status(403).json({ error: "Sem acesso a este hotel." });
    req.user = user; req.hotel = hotel;
    next();
  } catch (e) { next(e); }
}
const needStock = (req, res, next) => canStock(req.user.role) ? next() : res.status(403).json({ error: "Apenas Almoxarifado ou Administrador podem fazer isto." });
const needApprove = (req, res, next) => canApprove(req.user.role) ? next() : res.status(403).json({ error: "Apenas Almoxarifado ou Administrador podem aprovar/rejeitar." });

/* ============ helpers de domínio ============ */
async function nextNumero(hotelId, field, prefix) {
  await db.run("INSERT INTO almox_counters (hotel_id) VALUES (?) ON CONFLICT(hotel_id) DO NOTHING", [hotelId]);
  const row = await db.get("SELECT * FROM almox_counters WHERE hotel_id = ?", [hotelId]);
  const n = Number(row[field]) || 1;
  await db.run(`UPDATE almox_counters SET ${field} = ? WHERE hotel_id = ?`, [n + 1, hotelId]);
  return prefix + String(n).padStart(4, "0");
}

/* Registra um movimento e atualiza saldo + custo médio ponderado móvel. */
export async function registrarMovimento(hotelId, m) {
  const it = await db.get("SELECT * FROM almox_itens WHERE id = ? AND hotel_id = ?", [m.itemId, hotelId]);
  if (!it) { const e = new Error("Item não encontrado para movimentação."); e.status = 400; throw e; }
  let estoque = Number(it.estoque_atual);
  let custoMedio = Number(it.custo_medio);
  let custoUnit = Number(m.custoUnitario || 0);
  const qtd = Number(m.quantidade);

  if (m.tipo === "entrada") {
    const totalAntes = estoque * custoMedio;
    estoque += qtd;
    if (custoUnit > 0) custoMedio = estoque > 0 ? (totalAntes + qtd * custoUnit) / estoque : custoUnit;
  } else if (m.tipo === "saida") {
    if (qtd > estoque) { const e = new Error(`Estoque insuficiente para "${it.descricao}". Disponível: ${estoque} ${it.unidade}.`); e.status = 400; throw e; }
    estoque -= qtd;
    custoUnit = custoMedio;
  } else if (m.tipo === "ajuste") {
    estoque = qtd; // ajuste define o saldo absoluto
  }

  await db.run("UPDATE almox_itens SET estoque_atual = ?, custo_medio = ? WHERE id = ?", [estoque, custoMedio, it.id]);
  await db.run(`INSERT INTO almox_movimentacoes (id,hotel_id,item_id,data,tipo,quantidade,custo_unitario,saldo_apos,documento,origem,obs,usuario)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [newId(), hotelId, it.id, m.data || nowISO(), m.tipo, qtd, custoUnit, estoque, m.documento || "", m.origem || "", m.obs || "", m.usuario || ""]);
  return { estoqueAtual: estoque, custoMedio };
}

const itemOut = (i) => ({
  id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
  categoriaId: i.categoria_id, localizacao: i.localizacao,
  estoqueAtual: Number(i.estoque_atual), estoqueMinimo: Number(i.estoque_minimo),
  custoMedio: Number(i.custo_medio), ativo: !!Number(i.ativo), criadoEm: i.criado_em,
});

/* ============ DASHBOARD ============ */
r.get("/:hid/dashboard", hotelGuard, async (req, res, next) => {
  try {
    const itens = (await db.all("SELECT * FROM almox_itens WHERE hotel_id = ?", [req.hotel.id])).map(itemOut);
    const baixos = itens.filter((i) => i.ativo && i.estoqueAtual <= i.estoqueMinimo);
    const valor = itens.reduce((s, i) => s + i.estoqueAtual * (i.custoMedio || 0), 0);
    const pend = await db.get("SELECT COUNT(*) AS n FROM almox_requisicoes WHERE hotel_id = ? AND status = 'pendente'", [req.hotel.id]);
    const recentes = await db.all(`SELECT m.id, m.data, m.tipo, m.quantidade, m.documento, i.descricao FROM almox_movimentacoes m
      JOIN almox_itens i ON i.id = m.item_id WHERE m.hotel_id = ? ORDER BY m.data DESC LIMIT 8`, [req.hotel.id]);
    res.json({
      totalItens: itens.length,
      ativos: itens.filter((i) => i.ativo).length,
      zerados: itens.filter((i) => i.estoqueAtual <= 0).length,
      valorEstoque: valor,
      estoqueBaixo: baixos.length,
      requisicoesPendentes: Number(pend.n),
      alertas: baixos.slice(0, 8),
      recentes: recentes.map((m) => ({ ...m, quantidade: Number(m.quantidade) })),
    });
  } catch (e) { next(e); }
});

/* ============ CATEGORIAS ============ */
r.get("/:hid/categorias", hotelGuard, async (req, res, next) => {
  try { res.json(await db.all("SELECT id, nome FROM almox_categorias WHERE hotel_id = ? ORDER BY nome", [req.hotel.id])); } catch (e) { next(e); }
});
r.post("/:hid/categorias", hotelGuard, needStock, async (req, res, next) => {
  try {
    const { nome } = req.body || {}; if (!nome || !nome.trim()) return res.status(400).json({ error: "Informe o nome." });
    const id = newId();
    await db.run("INSERT INTO almox_categorias (id,hotel_id,nome) VALUES (?,?,?)", [id, req.hotel.id, nome.trim()]);
    res.status(201).json({ id, nome: nome.trim() });
  } catch (e) { next(e); }
});
r.put("/:hid/categorias/:id", hotelGuard, needStock, async (req, res, next) => {
  try {
    const { nome } = req.body || {}; if (!nome || !nome.trim()) return res.status(400).json({ error: "Informe o nome." });
    await db.run("UPDATE almox_categorias SET nome = ? WHERE id = ? AND hotel_id = ?", [nome.trim(), req.params.id, req.hotel.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
r.delete("/:hid/categorias/:id", hotelGuard, needStock, async (req, res, next) => {
  try {
    await db.run("UPDATE almox_itens SET categoria_id = NULL WHERE categoria_id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    await db.run("DELETE FROM almox_categorias WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ============ FORNECEDORES ============ */
r.get("/:hid/fornecedores", hotelGuard, async (req, res, next) => {
  try { res.json(await db.all("SELECT id,nome,cnpj,contato,telefone,email FROM almox_fornecedores WHERE hotel_id = ? ORDER BY nome", [req.hotel.id])); } catch (e) { next(e); }
});
r.post("/:hid/fornecedores", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {}; if (!b.nome || !b.nome.trim()) return res.status(400).json({ error: "Informe o nome." });
    const id = newId();
    await db.run("INSERT INTO almox_fornecedores (id,hotel_id,nome,cnpj,contato,telefone,email) VALUES (?,?,?,?,?,?,?)",
      [id, req.hotel.id, b.nome.trim(), b.cnpj || "", b.contato || "", b.telefone || "", b.email || ""]);
    res.status(201).json({ id });
  } catch (e) { next(e); }
});
r.put("/:hid/fornecedores/:id", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {}; if (!b.nome || !b.nome.trim()) return res.status(400).json({ error: "Informe o nome." });
    await db.run("UPDATE almox_fornecedores SET nome=?, cnpj=?, contato=?, telefone=?, email=? WHERE id = ? AND hotel_id = ?",
      [b.nome.trim(), b.cnpj || "", b.contato || "", b.telefone || "", b.email || "", req.params.id, req.hotel.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
r.delete("/:hid/fornecedores/:id", hotelGuard, needStock, async (req, res, next) => {
  try { await db.run("DELETE FROM almox_fornecedores WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ============ ITENS ============ */
r.get("/:hid/itens", hotelGuard, async (req, res, next) => {
  try { res.json((await db.all("SELECT * FROM almox_itens WHERE hotel_id = ? ORDER BY descricao", [req.hotel.id])).map(itemOut)); } catch (e) { next(e); }
});
r.post("/:hid/itens", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.codigo || !b.descricao) return res.status(400).json({ error: "Código e descrição são obrigatórios." });
    const dup = await db.get("SELECT 1 AS x FROM almox_itens WHERE hotel_id = ? AND lower(codigo) = lower(?)", [req.hotel.id, b.codigo.trim()]);
    if (dup) return res.status(409).json({ error: "Já existe um item com este código." });
    const id = newId();
    await db.run(`INSERT INTO almox_itens (id,hotel_id,codigo,descricao,unidade,categoria_id,localizacao,estoque_atual,estoque_minimo,custo_medio,ativo,criado_em)
      VALUES (?,?,?,?,?,?,?,0,?,0,?,?)`,
      [id, req.hotel.id, b.codigo.trim(), b.descricao.trim(), b.unidade || "UN", b.categoriaId || null, b.localizacao || "",
        Number(b.estoqueMinimo || 0), b.ativo === false ? 0 : 1, nowISO()]);
    const estoqueIni = Number(b.estoqueAtual || 0);
    if (estoqueIni > 0) {
      await registrarMovimento(req.hotel.id, { itemId: id, tipo: "entrada", quantidade: estoqueIni, custoUnitario: Number(b.custoMedio || 0),
        documento: "Estoque inicial", origem: "Cadastro de item", usuario: req.user.login });
    }
    res.status(201).json({ id });
  } catch (e) { next(e); }
});
/* Importação em lote (planilha): cria novos e atualiza mínimo/descrição dos existentes. */
r.post("/:hid/itens/import", hotelGuard, needStock, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body && req.body.itens) ? req.body.itens : [];
    if (!rows.length) return res.status(400).json({ error: "Nenhum item na planilha." });
    let added = 0, updated = 0;
    await db.tx(async () => {
      const existing = await db.all("SELECT * FROM almox_itens WHERE hotel_id = ?", [req.hotel.id]);
      const byCode = new Map(existing.map((i) => [String(i.codigo).trim().toLowerCase(), i]));
      const byDesc = new Map(existing.map((i) => [String(i.descricao).trim().toLowerCase(), i]));
      for (const it of rows) {
        const codigo = String(it.codigo || "").trim();
        const descricao = String(it.descricao || "").trim();
        if (!descricao) continue;
        const found = (codigo && byCode.get(codigo.toLowerCase())) || byDesc.get(descricao.toLowerCase());
        if (found) {
          await db.run("UPDATE almox_itens SET descricao=?, unidade=?, estoque_minimo=? WHERE id=?",
            [descricao, it.unidade || found.unidade, Number(it.estoqueMinimo || found.estoque_minimo || 0), found.id]);
          updated++;
        } else {
          const id = newId();
          const cod = codigo || ("IT" + String(existing.length + added + 1).padStart(4, "0"));
          await db.run(`INSERT INTO almox_itens (id,hotel_id,codigo,descricao,unidade,categoria_id,localizacao,estoque_atual,estoque_minimo,custo_medio,ativo,criado_em)
            VALUES (?,?,?,?,?,NULL,'',0,?,0,1,?)`, [id, req.hotel.id, cod, descricao, it.unidade || "UN", Number(it.estoqueMinimo || 0), nowISO()]);
          if (Number(it.estoqueAtual || 0) > 0) {
            await registrarMovimento(req.hotel.id, { itemId: id, tipo: "entrada", quantidade: Number(it.estoqueAtual), custoUnitario: Number(it.custo || 0),
              documento: "Estoque inicial", origem: "Importação de planilha", usuario: req.user.login });
          }
          added++;
        }
      }
    });
    res.json({ added, updated });
  } catch (e) { next(e); }
});
r.put("/:hid/itens/:id", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.descricao) return res.status(400).json({ error: "Informe a descrição." });
    await db.run(`UPDATE almox_itens SET descricao=?, unidade=?, categoria_id=?, localizacao=?, estoque_minimo=?, ativo=? WHERE id = ? AND hotel_id = ?`,
      [b.descricao.trim(), b.unidade || "UN", b.categoriaId || null, b.localizacao || "", Number(b.estoqueMinimo || 0), b.ativo === false ? 0 : 1, req.params.id, req.hotel.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
r.delete("/:hid/itens/:id", hotelGuard, needStock, async (req, res, next) => {
  try {
    const mv = await db.get("SELECT 1 AS x FROM almox_movimentacoes WHERE item_id = ? LIMIT 1", [req.params.id]);
    if (mv) return res.status(400).json({ error: "Este item possui movimentações. Inative-o em vez de excluir, para preservar o histórico." });
    await db.run("DELETE FROM almox_itens WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ============ KARDEX ============ */
r.get("/:hid/movimentacoes", hotelGuard, async (req, res, next) => {
  try {
    const params = [req.hotel.id];
    let sql = `SELECT m.*, i.codigo AS item_codigo, i.descricao AS item_descricao, i.unidade FROM almox_movimentacoes m
      JOIN almox_itens i ON i.id = m.item_id WHERE m.hotel_id = ?`;
    let limit = 500;
    if (req.query.itemId) { params.push(req.query.itemId); sql += " AND m.item_id = ?"; }
    if (req.query.de) { params.push(req.query.de); sql += " AND m.data >= ?"; limit = 5000; }
    if (req.query.ate) { params.push(req.query.ate + "T23:59:59.999Z"); sql += " AND m.data <= ?"; limit = 5000; }
    sql += ` ORDER BY m.data DESC LIMIT ${limit}`;
    res.json((await db.all(sql, params)).map((m) => ({
      id: m.id, data: m.data, tipo: m.tipo, quantidade: Number(m.quantidade), custoUnitario: Number(m.custo_unitario),
      saldoApos: Number(m.saldo_apos), documento: m.documento, origem: m.origem, obs: m.obs, usuario: m.usuario,
      itemCodigo: m.item_codigo, itemDescricao: m.item_descricao, unidade: m.unidade,
    })));
  } catch (e) { next(e); }
});

/* ============ ENTRADAS ============ */
r.get("/:hid/entradas", hotelGuard, async (req, res, next) => {
  try {
    const es = await db.all(`SELECT e.*, f.nome AS fornecedor_nome,
        (SELECT COUNT(*) FROM almox_entrada_itens ei WHERE ei.entrada_id = e.id) AS qtd_itens
      FROM almox_entradas e LEFT JOIN almox_fornecedores f ON f.id = e.fornecedor_id
      WHERE e.hotel_id = ? ORDER BY e.data DESC LIMIT 300`, [req.hotel.id]);
    res.json(es.map((e) => ({ id: e.id, numero: e.numero, data: e.data, notaFiscal: e.nota_fiscal, obs: e.obs, fornecedorNome: e.fornecedor_nome, qtdItens: Number(e.qtd_itens) })));
  } catch (e) { next(e); }
});
r.post("/:hid/entradas", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {};
    const itens = Array.isArray(b.itens) ? b.itens.filter((l) => l.itemId && Number(l.quantidade) > 0) : [];
    if (!itens.length) return res.status(400).json({ error: "Adicione ao menos um item." });
    let out;
    await db.tx(async () => {
      const numero = await nextNumero(req.hotel.id, "prox_ent", "ENT-");
      const id = newId();
      const data = b.data ? new Date(b.data + "T12:00:00").toISOString() : nowISO();
      await db.run("INSERT INTO almox_entradas (id,hotel_id,numero,data,fornecedor_id,nota_fiscal,obs) VALUES (?,?,?,?,?,?,?)",
        [id, req.hotel.id, numero, data, b.fornecedorId || null, b.notaFiscal || "", b.obs || ""]);
      for (const l of itens) {
        await db.run("INSERT INTO almox_entrada_itens (id,entrada_id,item_id,quantidade,custo_unitario) VALUES (?,?,?,?,?)",
          [newId(), id, l.itemId, Number(l.quantidade), Number(l.custoUnitario || 0)]);
        await registrarMovimento(req.hotel.id, { itemId: l.itemId, tipo: "entrada", quantidade: Number(l.quantidade), custoUnitario: Number(l.custoUnitario || 0),
          documento: numero, origem: "Entrada" + (b.notaFiscal ? " NF " + b.notaFiscal : ""), usuario: req.user.login, data });
      }
      out = { id, numero };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});

/* ============ REQUISIÇÕES ============ */
const reqOut = (x) => ({
  id: x.id, numero: x.numero, data: x.data, requisitante: x.requisitante, setor: x.setor, obs: x.obs,
  status: x.status, origem: x.origem, pdvId: x.pdv_id, diaData: x.dia_data,
  criadoPor: x.criado_por, aprovadoPor: x.aprovado_por, aprovadoEm: x.aprovado_em,
});

r.get("/:hid/requisicoes", hotelGuard, async (req, res, next) => {
  try {
    const rs = await db.all(`SELECT r.*,
        (SELECT COUNT(*) FROM almox_requisicao_itens ri WHERE ri.requisicao_id = r.id) AS qtd_itens,
        (SELECT COALESCE(SUM(COALESCE(ri.quantidade_real, ri.quantidade) * ri.custo_unitario), 0) FROM almox_requisicao_itens ri WHERE ri.requisicao_id = r.id) AS valor
      FROM almox_requisicoes r WHERE r.hotel_id = ? ORDER BY r.data DESC LIMIT 400`, [req.hotel.id]);
    res.json(rs.map((x) => ({ ...reqOut(x), qtdItens: Number(x.qtd_itens), valor: Number(x.valor) })));
  } catch (e) { next(e); }
});
r.get("/:hid/requisicoes/:id", hotelGuard, async (req, res, next) => {
  try {
    const x = await db.get("SELECT * FROM almox_requisicoes WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    if (!x) return res.status(404).json({ error: "Requisição não encontrada." });
    const itens = await db.all(`SELECT ri.id AS linha_id, ri.item_id, ri.produto_pdv_id, ri.quantidade, ri.quantidade_real, ri.custo_unitario,
        i.codigo, i.descricao, i.unidade, i.estoque_atual
      FROM almox_requisicao_itens ri LEFT JOIN almox_itens i ON i.id = ri.item_id WHERE ri.requisicao_id = ?`, [x.id]);
    let pdvName = null;
    if (x.pdv_id) { const p = await db.get("SELECT name FROM pdvs WHERE id = ?", [x.pdv_id]); pdvName = p ? p.name : null; }
    res.json({
      ...reqOut(x), pdvName,
      itens: itens.map((l) => ({
        linhaId: l.linha_id, itemId: l.item_id, produtoPdvId: l.produto_pdv_id,
        quantidade: Number(l.quantidade), quantidadeReal: l.quantidade_real == null ? null : Number(l.quantidade_real),
        custoUnitario: Number(l.custo_unitario), codigo: l.codigo, descricao: l.descricao || "(item removido)",
        unidade: l.unidade || "", estoqueAtual: l.estoque_atual == null ? null : Number(l.estoque_atual),
      })),
    });
  } catch (e) { next(e); }
});
/* Qualquer perfil com acesso ao hotel pode criar (entra como pendente). */
r.post("/:hid/requisicoes", hotelGuard, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.requisitante || !String(b.requisitante).trim()) return res.status(400).json({ error: "Informe o solicitante." });
    const itens = Array.isArray(b.itens) ? b.itens.filter((l) => l.itemId && Number(l.quantidade) > 0) : [];
    if (!itens.length) return res.status(400).json({ error: "Adicione ao menos um item com quantidade." });
    let out;
    await db.tx(async () => {
      const numero = await nextNumero(req.hotel.id, "prox_req", "REQ-");
      const id = newId();
      const data = b.data ? new Date(b.data + "T12:00:00").toISOString() : nowISO();
      await db.run(`INSERT INTO almox_requisicoes (id,hotel_id,numero,data,requisitante,setor,obs,status,origem,pdv_id,dia_data,criado_por,criado_por_id)
        VALUES (?,?,?,?,?,?,?,'pendente','manual',NULL,NULL,?,?)`,
        [id, req.hotel.id, numero, data, String(b.requisitante).trim(), b.setor || "", b.obs || "", req.user.name, req.user.id]);
      for (const l of itens) {
        const it = await db.get("SELECT custo_medio FROM almox_itens WHERE id = ? AND hotel_id = ?", [l.itemId, req.hotel.id]);
        if (!it) { const e = new Error("Item inválido na requisição."); e.status = 400; throw e; }
        await db.run("INSERT INTO almox_requisicao_itens (id,requisicao_id,item_id,produto_pdv_id,quantidade,quantidade_real,custo_unitario) VALUES (?,?,?,NULL,?,NULL,?)",
          [newId(), id, l.itemId, Number(l.quantidade), Number(it.custo_medio)]);
      }
      out = { id, numero };
    });
    await notifyApprovers(req.hotel, out.numero, req.user, null);
    res.status(201).json(out);
  } catch (e) { next(e); }
});

async function notifyApprovers(hotel, numero, creator, pdvName) {
  const { approversOfHotel } = await import("../helpers.js");
  const ids = (await approversOfHotel(hotel.id)).filter((id) => id !== creator.id);
  const origem = pdvName ? `Reposição do PDV ${pdvName}` : `por ${creator.name}`;
  await notify(ids, {
    titulo: `Nova requisição ${numero} aguardando aprovação`,
    corpo: `${hotel.name} · ${origem}`,
    tipo: "req-pendente",
    nav: { module: "almox", hotelId: hotel.id, page: "req" },
  });
}

/* Aprovar: informa a quantidade real, abate o estoque e — se veio do Par Stock —
   lança automaticamente o "Reposto" no dia do PDV. */
r.post("/:hid/requisicoes/:id/aprovar", hotelGuard, needApprove, async (req, res, next) => {
  try {
    const reais = (req.body && req.body.reais) || {};
    const obsAprov = (req.body && req.body.obs) || "";
    let x, linhas;
    await db.tx(async () => {
      x = await db.get("SELECT * FROM almox_requisicoes WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
      if (!x) { const e = new Error("Requisição não encontrada."); e.status = 404; throw e; }
      if (x.status !== "pendente") { const e = new Error("Esta requisição não está pendente."); e.status = 400; throw e; }
      linhas = await db.all("SELECT * FROM almox_requisicao_itens WHERE requisicao_id = ?", [x.id]);
      for (const l of linhas) {
        const qReal = reais[l.id] != null ? Number(reais[l.id]) : Number(l.quantidade);
        if (!(qReal >= 0)) { const e = new Error("Quantidade real inválida."); e.status = 400; throw e; }
        l.quantidade_real = qReal;
        await db.run("UPDATE almox_requisicao_itens SET quantidade_real = ? WHERE id = ?", [qReal, l.id]);
        if (qReal > 0) {
          await registrarMovimento(req.hotel.id, {
            itemId: l.item_id, tipo: "saida", quantidade: qReal, documento: x.numero,
            origem: "Requisição " + (x.setor || x.requisitante), obs: "Aprovada por " + req.user.login, usuario: req.user.login });
        }
      }
      const obs = obsAprov ? (x.obs ? x.obs + " · " : "") + "Aprovação: " + obsAprov : x.obs;
      await db.run("UPDATE almox_requisicoes SET status='aprovada', aprovado_por=?, aprovado_em=?, obs=? WHERE id = ?",
        [req.user.name, nowISO(), obs, x.id]);

      /* ---- integração: lança o Reposto no dia do PDV ---- */
      if (x.origem === "parstock" && x.pdv_id && x.dia_data) {
        const dayRow = await db.get("SELECT * FROM days WHERE pdv_id = ? AND date = ?", [x.pdv_id, x.dia_data]);
        if (dayRow) {
          const data = JSON.parse(dayRow.data);
          data.items = data.items || {};
          for (const l of linhas) {
            if (!l.produto_pdv_id) continue;
            const rec = data.items[l.produto_pdv_id] || {};
            rec.r = Number(l.quantidade_real != null ? l.quantidade_real : l.quantidade) || 0;
            data.items[l.produto_pdv_id] = rec;
          }
          await db.run("UPDATE days SET data = ? WHERE pdv_id = ? AND date = ?", [JSON.stringify(data), x.pdv_id, x.dia_data]);
        }
      }
    });
    if (x.criado_por_id && x.criado_por_id !== req.user.id) {
      const pdvInfo = x.pdv_id ? await db.get("SELECT name FROM pdvs WHERE id = ?", [x.pdv_id]) : null;
      await notify([x.criado_por_id], {
        titulo: `Requisição ${x.numero} aprovada`,
        corpo: (pdvInfo ? `Reposição do PDV ${pdvInfo.name} liberada — quantidades lançadas como "Reposto".` : `Aprovada por ${req.user.name}.`),
        tipo: "req-aprovada",
        nav: x.pdv_id ? { module: "loja", pdvId: x.pdv_id, date: x.dia_data, page: "rep" } : { module: "almox", hotelId: req.hotel.id, page: "req" },
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
/* Rejeitar: não movimenta estoque. */
r.post("/:hid/requisicoes/:id/rejeitar", hotelGuard, needApprove, async (req, res, next) => {
  try {
    const motivo = (req.body && req.body.motivo) || "";
    const x = await db.get("SELECT * FROM almox_requisicoes WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    if (!x) return res.status(404).json({ error: "Requisição não encontrada." });
    if (x.status !== "pendente") return res.status(400).json({ error: "Esta requisição não está pendente." });
    const obs = motivo ? (x.obs ? x.obs + " · " : "") + "Rejeição: " + motivo : x.obs;
    await db.run("UPDATE almox_requisicoes SET status='rejeitada', aprovado_por=?, aprovado_em=?, obs=? WHERE id = ?",
      [req.user.name, nowISO(), obs, x.id]);
    if (x.criado_por_id && x.criado_por_id !== req.user.id) {
      const pdvInfo = x.pdv_id ? await db.get("SELECT name FROM pdvs WHERE id = ?", [x.pdv_id]) : null;
      await notify([x.criado_por_id], {
        titulo: `Requisição ${x.numero} rejeitada`,
        corpo: (motivo ? "Motivo: " + motivo : "Sem motivo informado.") + (pdvInfo ? ` · PDV ${pdvInfo.name}` : ""),
        tipo: "req-rejeitada",
        nav: x.pdv_id ? { module: "loja", pdvId: x.pdv_id, date: x.dia_data, page: "rep" } : { module: "almox", hotelId: req.hotel.id, page: "req" },
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ============ AJUSTE DE INVENTÁRIO ============ */
r.post("/:hid/ajustes", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.itemId) return res.status(400).json({ error: "Selecione o item." });
    await db.tx(async () => {
      await registrarMovimento(req.hotel.id, { itemId: b.itemId, tipo: "ajuste", quantidade: Number(b.novoSaldo || 0),
        documento: "AJUSTE", origem: "Ajuste de inventário", obs: b.obs || "", usuario: req.user.login });
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ============ CONTAGEM DE INVENTÁRIO ============ */
r.get("/:hid/contagens", hotelGuard, async (req, res, next) => {
  try {
    const cs = await db.all(`SELECT c.*, (SELECT COUNT(*) FROM almox_contagem_itens ci WHERE ci.contagem_id = c.id) AS qtd_itens
      FROM almox_contagens c WHERE c.hotel_id = ? ORDER BY c.data DESC LIMIT 100`, [req.hotel.id]);
    res.json(cs.map((c) => ({ id: c.id, numero: c.numero, data: c.data, responsavel: c.responsavel, ajustes: Number(c.ajustes), qtdItens: Number(c.qtd_itens) })));
  } catch (e) { next(e); }
});
r.get("/:hid/contagens/:id", hotelGuard, async (req, res, next) => {
  try {
    const c = await db.get("SELECT * FROM almox_contagens WHERE id = ? AND hotel_id = ?", [req.params.id, req.hotel.id]);
    if (!c) return res.status(404).json({ error: "Contagem não encontrada." });
    const itens = await db.all(`SELECT ci.*, i.codigo, i.descricao, i.unidade FROM almox_contagem_itens ci
      LEFT JOIN almox_itens i ON i.id = ci.item_id WHERE ci.contagem_id = ? ORDER BY i.descricao`, [c.id]);
    res.json({ id: c.id, numero: c.numero, data: c.data, responsavel: c.responsavel, ajustes: Number(c.ajustes),
      itens: itens.map((l) => ({ sistema: Number(l.sistema), contado: Number(l.contado), diverg: Number(l.diverg), codigo: l.codigo, descricao: l.descricao || "(removido)", unidade: l.unidade || "" })) });
  } catch (e) { next(e); }
});
r.post("/:hid/contagens", hotelGuard, needStock, async (req, res, next) => {
  try {
    const b = req.body || {};
    const itens = Array.isArray(b.itens) ? b.itens : [];
    if (!itens.length) return res.status(400).json({ error: "Nenhum item para contar." });
    let out;
    await db.tx(async () => {
      const numero = await nextNumero(req.hotel.id, "prox_cont", "CONT-");
      let ajustes = 0;
      const linhas = [];
      for (const l of itens) {
        const it = await db.get("SELECT id, estoque_atual FROM almox_itens WHERE id = ? AND hotel_id = ?", [l.itemId, req.hotel.id]);
        if (!it) continue;
        const sistema = Number(it.estoque_atual);
        const contado = Number(l.contado);
        if (!isFinite(contado) || contado < 0) { const e = new Error("Quantidade contada inválida."); e.status = 400; throw e; }
        const diverg = contado - sistema;
        linhas.push({ itemId: it.id, sistema, contado, diverg });
        if (diverg !== 0) {
          await registrarMovimento(req.hotel.id, { itemId: it.id, tipo: "ajuste", quantidade: contado,
            documento: numero, origem: "Contagem " + (b.responsavel || ""), obs: "Divergência de contagem: " + (diverg > 0 ? "+" : "") + diverg, usuario: req.user.login });
          ajustes++;
        }
      }
      const id = newId();
      await db.run("INSERT INTO almox_contagens (id,hotel_id,numero,data,responsavel,ajustes) VALUES (?,?,?,?,?,?)",
        [id, req.hotel.id, numero, nowISO(), b.responsavel || "", ajustes]);
      for (const l of linhas) {
        await db.run("INSERT INTO almox_contagem_itens (id,contagem_id,item_id,sistema,contado,diverg) VALUES (?,?,?,?,?,?)",
          [newId(), id, l.itemId, l.sistema, l.contado, l.diverg]);
      }
      out = { id, numero, ajustes };
    });
    res.status(201).json(out);
  } catch (e) { next(e); }
});

export default r;
