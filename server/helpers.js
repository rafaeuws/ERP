import { db } from "./db.js";

export const todayISO = () => new Date().toLocaleDateString("en-CA");

export async function userRow(id) {
  const u = await db.get("SELECT * FROM users WHERE id = ?", [id]);
  if (!u) return null;
  return { id: u.id, name: u.name, login: u.login, role: u.role, hotelIds: JSON.parse(u.hotel_ids || "[]"), mustChange: !!Number(u.must_change) };
}

export const publicUser = (u) => ({ id: u.id, name: u.name, login: u.login, role: u.role, hotelIds: u.hotelIds, mustChange: u.mustChange });

export function userHasHotel(user, hotelId) {
  if (user.role === "admin") return true;
  return (user.hotelIds || []).includes(hotelId);
}

export async function userHasPdv(user, pdvId) {
  const pdv = await db.get("SELECT hotel_id FROM pdvs WHERE id = ?", [pdvId]);
  if (!pdv) return false;
  return userHasHotel(user, pdv.hotel_id);
}

export const canValidate = (role) => role === "admin" || role === "gerente";
export const canEditRetroactive = (role) => role === "admin" || role === "gerente";
export const canManagePdvs = (role) => role === "admin" || role === "gerente";

/* ---------- Módulos e perfis do sistema unificado ----------
   Loja (Par Stock):      admin, gerente, supervisor
   Almoxarifado (ERP):    admin, almoxarifado, atendente          */
export const ALL_ROLES = ["admin", "gerente", "supervisor", "almoxarifado", "atendente"];
export const hasLoja = (role) => ["admin", "gerente", "supervisor"].includes(role);
export const hasAlmox = (role) => ["admin", "almoxarifado", "atendente"].includes(role);
export const canApprove = (role) => role === "admin" || role === "almoxarifado";
export const canStock = (role) => role === "admin" || role === "almoxarifado";

/* Usuários que devem ser notificados sobre requisições pendentes de um hotel:
   administradores + usuários "almoxarifado" vinculados ao hotel. */
export async function approversOfHotel(hotelId) {
  const rows = await db.all("SELECT id, role, hotel_ids FROM users");
  return rows
    .filter((u) => u.role === "admin" || (u.role === "almoxarifado" && JSON.parse(u.hotel_ids || "[]").includes(hotelId)))
    .map((u) => u.id);
}
