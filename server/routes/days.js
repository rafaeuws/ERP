import { Router } from "express";
import { db, nowISO, newId } from "../db.js";
import { authRequired } from "../auth.js";
import { userRow, userHasPdv, canValidate, canEditRetroactive, todayISO } from "../helpers.js";

const r = Router();
r.use(authRequired);

async function pdvGuard(req, res, next) {
  try {
    const user = await userRow(req.auth.id);
    if (!(await userHasPdv(user, req.params.pid))) return res.status(403).json({ error: "Sem acesso a este PDV." });
    req.user = user; req.pdvId = req.params.pid; next();
  } catch (e) { next(e); }
}

const dayOut = (row) => ({
  date: row.date, ...JSON.parse(row.data), status: row.status,
  savedBy: row.saved_by ? JSON.parse(row.saved_by) : null, savedAt: row.saved_at,
  validatedBy: row.validated_by ? JSON.parse(row.validated_by) : null, validatedAt: row.validated_at,
});

r.get("/:pid/products", pdvGuard, async (req, res, next) => {
  try { const row = await db.get("SELECT items FROM products WHERE pdv_id = ?", [req.pdvId]); res.json(row ? JSON.parse(row.items) : []); } catch (e) { next(e); }
});

r.put("/:pid/products", pdvGuard, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body && req.body.items) || [];
    await db.run("INSERT INTO products (pdv_id, items) VALUES (?, ?) ON CONFLICT(pdv_id) DO UPDATE SET items = excluded.items", [req.pdvId, JSON.stringify(items)]);
    res.json(items);
  } catch (e) { next(e); }
});

r.get("/:pid/index", pdvGuard, async (req, res, next) => {
  try {
    const rows = await db.all("SELECT date, status FROM days WHERE pdv_id = ? ORDER BY date", [req.pdvId]);
    res.json({ dates: rows.map((x) => x.date), pending: rows.filter((x) => x.status === "pending").map((x) => x.date) });
  } catch (e) { next(e); }
});

r.get("/:pid/days", pdvGuard, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rows = (from && to)
      ? await db.all("SELECT * FROM days WHERE pdv_id = ? AND date >= ? AND date <= ? ORDER BY date", [req.pdvId, from, to])
      : await db.all("SELECT * FROM days WHERE pdv_id = ? ORDER BY date", [req.pdvId]);
    const map = {}; for (const row of rows) map[row.date] = dayOut(row); res.json(map);
  } catch (e) { next(e); }
});

r.get("/:pid/day/:date", pdvGuard, async (req, res, next) => {
  try { const row = await db.get("SELECT * FROM days WHERE pdv_id = ? AND date = ?", [req.pdvId, req.params.date]); res.json(row ? dayOut(row) : null); } catch (e) { next(e); }
});

r.put("/:pid/day/:date", pdvGuard, async (req, res, next) => {
  try {
    const date = req.params.date, user = req.user;
    if (!canEditRetroactive(user.role) && date < todayISO()) return res.status(403).json({ error: "Seu perfil não pode alterar dias anteriores a hoje." });
    const payload = req.body || {};
    const data = { time: payload.time || "", resp: payload.resp || "", items: payload.items || {} };
    const stamp = JSON.stringify({ id: user.id, name: user.name, role: user.role });
    const now = nowISO();
    const supervisor = user.role === "supervisor";
    const status = supervisor ? "pending" : "validated";
    await db.run(`INSERT INTO days (pdv_id, date, data, status, saved_by, saved_at, validated_by, validated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pdv_id, date) DO UPDATE SET data=excluded.data, status=excluded.status, saved_by=excluded.saved_by,
        saved_at=excluded.saved_at, validated_by=excluded.validated_by, validated_at=excluded.validated_at`,
      [req.pdvId, date, JSON.stringify(data), status, stamp, now, supervisor ? null : stamp, supervisor ? null : now]);
    res.json(dayOut(await db.get("SELECT * FROM days WHERE pdv_id = ? AND date = ?", [req.pdvId, date])));
  } catch (e) { next(e); }
});

r.post("/:pid/day/:date/validate", pdvGuard, async (req, res, next) => {
  try {
    if (!canValidate(req.user.role)) return res.status(403).json({ error: "Apenas gerente ou administrador podem validar." });
    const row = await db.get("SELECT * FROM days WHERE pdv_id = ? AND date = ?", [req.pdvId, req.params.date]);
    if (!row) return res.status(404).json({ error: "Dia não encontrado." });
    const stamp = JSON.stringify({ id: req.user.id, name: req.user.name, role: req.user.role });
    await db.run("UPDATE days SET status='validated', validated_by=?, validated_at=? WHERE pdv_id=? AND date=?", [stamp, nowISO(), req.pdvId, req.params.date]);
    res.json(dayOut(await db.get("SELECT * FROM days WHERE pdv_id = ? AND date = ?", [req.pdvId, req.params.date])));
  } catch (e) { next(e); }
});

/* ============ INTEGRAÇÃO COM O ALMOXARIFADO ============ */

/* Itens do almoxarifado do hotel deste PDV — usados para vincular produtos e montar a requisição. */
r.get("/:pid/erp-itens", pdvGuard, async (req, res, next) => {
  try {
    const pdv = await db.get("SELECT hotel_id FROM pdvs WHERE id = ?", [req.pdvId]);
    const itens = await db.all("SELECT id, codigo, descricao, unidade, estoque_atual, ativo FROM almox_itens WHERE hotel_id = ? ORDER BY descricao", [pdv.hotel_id]);
    res.json(itens.filter((i) => Number(i.ativo)).map((i) => ({ id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, estoqueAtual: Number(i.estoque_atual) })));
  } catch (e) { next(e); }
});

const reqLite = (x) => ({ id: x.id, numero: x.numero, data: x.data, status: x.status, obs: x.obs, aprovadoPor: x.aprovado_por, aprovadoEm: x.aprovado_em, criadoPor: x.criado_por });

/* Requisições de reposição já enviadas para um dia do PDV (a mais recente primeiro). */
r.get("/:pid/day/:date/requisicao", pdvGuard, async (req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM almox_requisicoes WHERE pdv_id = ? AND dia_data = ? ORDER BY data DESC", [req.pdvId, req.params.date]);
    if (!rows.length) return res.json(null);
    const x = rows[0];
    const itens = await db.all(`SELECT ri.*, i.descricao, i.unidade FROM almox_requisicao_itens ri
      LEFT JOIN almox_itens i ON i.id = ri.item_id WHERE ri.requisicao_id = ?`, [x.id]);
    res.json({ ...reqLite(x), historico: rows.slice(1).map(reqLite),
      itens: itens.map((l) => ({ produtoPdvId: l.produto_pdv_id, descricao: l.descricao || "(item removido)", unidade: l.unidade || "",
        quantidade: Number(l.quantidade), quantidadeReal: l.quantidade_real == null ? null : Number(l.quantidade_real) })) });
  } catch (e) { next(e); }
});

/* Envia a reposição do dia como requisição pendente no almoxarifado do hotel. */
r.post("/:pid/day/:date/enviar-reposicao", pdvGuard, async (req, res, next) => {
  try {
    const date = req.params.date;
    const body = req.body || {};
    const linhas = Array.isArray(body.itens) ? body.itens.filter((l) => l.itemId && Number(l.qty) > 0) : [];
    if (!linhas.length) return res.status(400).json({ error: "Nenhum item com vínculo e quantidade para enviar." });

    const pdv = await db.get("SELECT * FROM pdvs WHERE id = ?", [req.pdvId]);
    const hotel = await db.get("SELECT * FROM hotels WHERE id = ?", [pdv.hotel_id]);

    const pendente = await db.get("SELECT numero FROM almox_requisicoes WHERE pdv_id = ? AND dia_data = ? AND status = 'pendente'", [req.pdvId, date]);
    if (pendente) return res.status(409).json({ error: `Já existe a requisição ${pendente.numero} pendente para este dia. Aguarde a análise do almoxarifado.` });

    // valida itens e monta a requisição
    let out;
    await db.tx(async () => {
      // numeração
      await db.run("INSERT INTO almox_counters (hotel_id) VALUES (?) ON CONFLICT(hotel_id) DO NOTHING", [hotel.id]);
      const cnt = await db.get("SELECT prox_req FROM almox_counters WHERE hotel_id = ?", [hotel.id]);
      const n = Number(cnt.prox_req) || 1;
      await db.run("UPDATE almox_counters SET prox_req = ? WHERE hotel_id = ?", [n + 1, hotel.id]);
      const numero = "REQ-" + String(n).padStart(4, "0");
      const id = newId();
      await db.run(`INSERT INTO almox_requisicoes (id,hotel_id,numero,data,requisitante,setor,obs,status,origem,pdv_id,dia_data,criado_por,criado_por_id)
        VALUES (?,?,?,?,?,?,?,'pendente','parstock',?,?,?,?)`,
        [id, hotel.id, numero, nowISO(), req.user.name, "PDV " + pdv.name,
          (body.obs ? body.obs + " · " : "") + "Reposição do dia " + date.split("-").reverse().join("/") + " — " + pdv.name,
          req.pdvId, date, req.user.name, req.user.id]);
      for (const l of linhas) {
        const it = await db.get("SELECT * FROM almox_itens WHERE id = ? AND hotel_id = ?", [l.itemId, hotel.id]);
        if (!it) { const e = new Error("Um dos itens vinculados não existe no almoxarifado deste hotel."); e.status = 400; throw e; }
        await db.run("INSERT INTO almox_requisicao_itens (id,requisicao_id,item_id,produto_pdv_id,quantidade,quantidade_real,custo_unitario) VALUES (?,?,?,?,?,NULL,?)",
          [newId(), id, l.itemId, l.productId || null, Number(l.qty), Number(it.custo_medio)]);
      }
      out = { id, numero };
    });

    // grava os vínculos produto→item para os próximos envios
    if (Array.isArray(body.itens)) {
      const row = await db.get("SELECT items FROM products WHERE pdv_id = ?", [req.pdvId]);
      if (row) {
        const items = JSON.parse(row.items);
        let changed = false;
        for (const l of body.itens) {
          if (!l.productId || !l.itemId) continue;
          const p = items.find((x) => x.id === l.productId);
          if (p && p.itemId !== l.itemId) { p.itemId = l.itemId; changed = true; }
        }
        if (changed) await db.run("UPDATE products SET items = ? WHERE pdv_id = ?", [JSON.stringify(items), req.pdvId]);
      }
    }

    // notifica quem aprova
    const { approversOfHotel } = await import("../helpers.js");
    const { notify } = await import("./notif.js");
    const ids = (await approversOfHotel(hotel.id)).filter((x) => x !== req.user.id);
    await notify(ids, {
      titulo: `Nova requisição ${out.numero} aguardando aprovação`,
      corpo: `${hotel.name} · Reposição do PDV ${pdv.name} (${date.split("-").reverse().join("/")}) · enviada por ${req.user.name}`,
      tipo: "req-pendente",
      nav: { module: "almox", hotelId: hotel.id, page: "req" },
    });

    res.status(201).json(out);
  } catch (e) { next(e); }
});

r.get("/:pid/export", pdvGuard, async (req, res, next) => {
  try {
    const products = await db.get("SELECT items FROM products WHERE pdv_id = ?", [req.pdvId]);
    const days = await db.all("SELECT * FROM days WHERE pdv_id = ? ORDER BY date", [req.pdvId]);
    res.json({ _type: "parstock-pdv-backup", version: 1, exportedAt: nowISO(), products: products ? JSON.parse(products.items) : [], days: days.map(dayOut) });
  } catch (e) { next(e); }
});

r.post("/:pid/import", pdvGuard, async (req, res, next) => {
  try {
    if (!canValidate(req.user.role)) return res.status(403).json({ error: "Apenas gerente ou administrador podem importar." });
    const d = req.body || {};
    if (d._type !== "parstock-pdv-backup") return res.status(400).json({ error: "Arquivo de backup inválido." });
    await db.tx(async () => {
      await db.run("INSERT INTO products (pdv_id, items) VALUES (?, ?) ON CONFLICT(pdv_id) DO UPDATE SET items = excluded.items", [req.pdvId, JSON.stringify(d.products || [])]);
      for (const day of d.days || []) {
        const data = { time: day.time || "", resp: day.resp || "", items: day.items || {} };
        await db.run(`INSERT INTO days (pdv_id,date,data,status,saved_by,saved_at,validated_by,validated_at) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(pdv_id,date) DO UPDATE SET data=excluded.data,status=excluded.status,saved_by=excluded.saved_by,saved_at=excluded.saved_at,validated_by=excluded.validated_by,validated_at=excluded.validated_at`,
          [req.pdvId, day.date, JSON.stringify(data), day.status || "validated",
            day.savedBy ? JSON.stringify(day.savedBy) : null, day.savedAt || null,
            day.validatedBy ? JSON.stringify(day.validatedBy) : null, day.validatedAt || null]);
      }
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
