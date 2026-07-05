import { db } from "./db.js";

export const todayISO = () => new Date().toLocaleDateString("en-CA");

/* ---------- Perfis / múltiplas permissões ----------
   A coluna users.role guarda um OU MAIS perfis separados por vírgula
   (ex.: "supervisor,atendente"). Tudo abaixo aceita user-objeto,
   array de perfis ou string (um ou vários perfis), de forma retrocompatível. */
export const ALL_ROLES = ["admin", "gerente", "supervisor", "almoxarifado", "atendente"];
export const parseRoles = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
export const rolesOf = (x) =>
  Array.isArray(x) ? x.filter(Boolean)
  : (x && typeof x === "object") ? (Array.isArray(x.roles) && x.roles.length ? x.roles : parseRoles(x.role))
  : parseRoles(x);
const anyRole = (x, allowed) => rolesOf(x).some((r) => allowed.includes(r));

export async function userRow(id) {
  const u = await db.get("SELECT * FROM users WHERE id = ?", [id]);
  if (!u) return null;
  const roles = parseRoles(u.role);
  return { id: u.id, name: u.name, login: u.login, role: roles[0] || "", roles, hotelIds: JSON.parse(u.hotel_ids || "[]"), mustChange: !!Number(u.must_change) };
}

export const publicUser = (u) => ({ id: u.id, name: u.name, login: u.login, role: u.role, roles: u.roles || parseRoles(u.role), hotelIds: u.hotelIds, mustChange: u.mustChange });

export const isAdmin = (x) => rolesOf(x).includes("admin");

export function userHasHotel(user, hotelId) {
  if (isAdmin(user)) return true;
  return (user.hotelIds || []).includes(hotelId);
}

export async function userHasPdv(user, pdvId) {
  const pdv = await db.get("SELECT hotel_id FROM pdvs WHERE id = ?", [pdvId]);
  if (!pdv) return false;
  return userHasHotel(user, pdv.hotel_id);
}

export const canValidate = (x) => anyRole(x, ["admin", "gerente"]);
export const canEditRetroactive = (x) => anyRole(x, ["admin", "gerente"]);
export const canManagePdvs = (x) => anyRole(x, ["admin", "gerente"]);

/* ---------- Módulos do sistema unificado ----------
   Loja (Par Stock):      admin, gerente, supervisor
   Almoxarifado (ERP):    admin, almoxarifado, atendente          */
export const hasLoja = (x) => anyRole(x, ["admin", "gerente", "supervisor"]);
export const hasAlmox = (x) => anyRole(x, ["admin", "almoxarifado", "atendente"]);
export const canApprove = (x) => anyRole(x, ["admin", "almoxarifado"]);
export const canStock = (x) => anyRole(x, ["admin", "almoxarifado"]);

/* Usuários notificados sobre requisições pendentes de um hotel:
   administradores + usuários com perfil "almoxarifado" vinculados ao hotel. */
export async function approversOfHotel(hotelId) {
  const rows = await db.all("SELECT id, role, hotel_ids FROM users");
  return rows
    .filter((u) => {
      const roles = parseRoles(u.role);
      if (roles.includes("admin")) return true;
      return roles.includes("almoxarifado") && JSON.parse(u.hotel_ids || "[]").includes(hotelId);
    })
    .map((u) => u.id);
}
