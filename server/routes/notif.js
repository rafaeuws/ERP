import { Router } from "express";
import { db, newId, nowISO } from "../db.js";
import { authRequired } from "../auth.js";

/* Cria uma notificação para cada usuário da lista. `nav` é um objeto de navegação
   que o front usa para levar o usuário direto à tela certa ao clicar. */
export async function notify(userIds, { titulo, corpo = "", tipo = "", nav = null }) {
  const ids = [...new Set(userIds)].filter(Boolean);
  for (const uid of ids) {
    await db.run("INSERT INTO notificacoes (id,user_id,titulo,corpo,tipo,nav,lida,criado_em) VALUES (?,?,?,?,?,?,0,?)",
      [newId(), uid, titulo, corpo, tipo, nav ? JSON.stringify(nav) : "", nowISO()]);
  }
}

const r = Router();
r.use(authRequired);

r.get("/", async (req, res, next) => {
  try {
    const rows = await db.all("SELECT * FROM notificacoes WHERE user_id = ? ORDER BY criado_em DESC LIMIT 30", [req.auth.id]);
    const unread = await db.get("SELECT COUNT(*) AS n FROM notificacoes WHERE user_id = ? AND lida = 0", [req.auth.id]);
    res.json({
      unread: Number(unread.n),
      list: rows.map((n) => ({ id: n.id, titulo: n.titulo, corpo: n.corpo, tipo: n.tipo, nav: n.nav ? JSON.parse(n.nav) : null, lida: !!Number(n.lida), criadoEm: n.criado_em })),
    });
  } catch (e) { next(e); }
});

r.post("/:id/lida", async (req, res, next) => {
  try { await db.run("UPDATE notificacoes SET lida = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.auth.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

r.post("/todas-lidas", async (req, res, next) => {
  try { await db.run("UPDATE notificacoes SET lida = 1 WHERE user_id = ?", [req.auth.id]); res.json({ ok: true }); } catch (e) { next(e); }
});

export default r;
