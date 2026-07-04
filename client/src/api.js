const TOKEN_KEY = "parstock.token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); };

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Erro de comunicação com o servidor.");
    err.status = res.status;
    if (res.status === 401 && getToken()) { setToken(null); }
    throw err;
  }
  return data;
}

export const api = {
  login: (login, password) => req("/login", { method: "POST", body: { login, password } }),
  me: () => req("/me"),
  changePassword: (currentPassword, newPassword) => req("/change-password", { method: "POST", body: { currentPassword, newPassword } }),

  listUsers: () => req("/users"),
  createUser: (u) => req("/users", { method: "POST", body: u }),
  updateUser: (id, u) => req("/users/" + id, { method: "PUT", body: u }),
  deleteUser: (id) => req("/users/" + id, { method: "DELETE" }),

  listHotels: () => req("/hotels"),
  createHotel: (name) => req("/hotels", { method: "POST", body: { name } }),
  deleteHotel: (id) => req("/hotels/" + id, { method: "DELETE" }),

  listPdvs: (hotelId) => req("/pdvs?hotelId=" + encodeURIComponent(hotelId)),
  createPdv: (hotelId, name) => req("/pdvs", { method: "POST", body: { hotelId, name } }),
  deletePdv: (id) => req("/pdvs/" + id, { method: "DELETE" }),

  getProducts: (pid) => req("/pdvs/" + pid + "/products"),
  saveProducts: (pid, items) => req("/pdvs/" + pid + "/products", { method: "PUT", body: items }),
  getIndex: (pid) => req("/pdvs/" + pid + "/index"),
  getDays: (pid, from, to) => req("/pdvs/" + pid + "/days" + (from && to ? `?from=${from}&to=${to}` : "")),
  getDay: (pid, date) => req("/pdvs/" + pid + "/day/" + date),
  saveDay: (pid, date, rec) => req("/pdvs/" + pid + "/day/" + date, { method: "PUT", body: rec }),
  validateDay: (pid, date) => req("/pdvs/" + pid + "/day/" + date + "/validate", { method: "POST" }),
  exportPdv: (pid) => req("/pdvs/" + pid + "/export"),
  importPdv: (pid, dump) => req("/pdvs/" + pid + "/import", { method: "POST", body: dump }),

  /* ---- integração Loja → Almoxarifado ---- */
  erpItens: (pid) => req("/pdvs/" + pid + "/erp-itens"),
  getReposicaoReq: (pid, date) => req("/pdvs/" + pid + "/day/" + date + "/requisicao"),
  enviarReposicao: (pid, date, payload) => req("/pdvs/" + pid + "/day/" + date + "/enviar-reposicao", { method: "POST", body: payload }),

  /* ---- notificações ---- */
  notifs: () => req("/notificacoes"),
  notifLida: (id) => req("/notificacoes/" + id + "/lida", { method: "POST" }),
  notifTodasLidas: () => req("/notificacoes/todas-lidas", { method: "POST" }),
};

/* ---- módulo Almoxarifado ---- */
export const almox = {
  dashboard: (hid) => req(`/almox/${hid}/dashboard`),
  categorias: (hid) => req(`/almox/${hid}/categorias`),
  criarCategoria: (hid, nome) => req(`/almox/${hid}/categorias`, { method: "POST", body: { nome } }),
  editarCategoria: (hid, id, nome) => req(`/almox/${hid}/categorias/${id}`, { method: "PUT", body: { nome } }),
  excluirCategoria: (hid, id) => req(`/almox/${hid}/categorias/${id}`, { method: "DELETE" }),
  fornecedores: (hid) => req(`/almox/${hid}/fornecedores`),
  criarFornecedor: (hid, b) => req(`/almox/${hid}/fornecedores`, { method: "POST", body: b }),
  editarFornecedor: (hid, id, b) => req(`/almox/${hid}/fornecedores/${id}`, { method: "PUT", body: b }),
  excluirFornecedor: (hid, id) => req(`/almox/${hid}/fornecedores/${id}`, { method: "DELETE" }),
  itens: (hid) => req(`/almox/${hid}/itens`),
  criarItem: (hid, b) => req(`/almox/${hid}/itens`, { method: "POST", body: b }),
  importarItens: (hid, itens) => req(`/almox/${hid}/itens/import`, { method: "POST", body: { itens } }),
  editarItem: (hid, id, b) => req(`/almox/${hid}/itens/${id}`, { method: "PUT", body: b }),
  excluirItem: (hid, id) => req(`/almox/${hid}/itens/${id}`, { method: "DELETE" }),
  movimentacoes: (hid, q = "") => req(`/almox/${hid}/movimentacoes${q}`),
  entradas: (hid) => req(`/almox/${hid}/entradas`),
  criarEntrada: (hid, b) => req(`/almox/${hid}/entradas`, { method: "POST", body: b }),
  requisicoes: (hid) => req(`/almox/${hid}/requisicoes`),
  requisicao: (hid, id) => req(`/almox/${hid}/requisicoes/${id}`),
  criarRequisicao: (hid, b) => req(`/almox/${hid}/requisicoes`, { method: "POST", body: b }),
  aprovarRequisicao: (hid, id, b) => req(`/almox/${hid}/requisicoes/${id}/aprovar`, { method: "POST", body: b }),
  rejeitarRequisicao: (hid, id, motivo) => req(`/almox/${hid}/requisicoes/${id}/rejeitar`, { method: "POST", body: { motivo } }),
  ajuste: (hid, b) => req(`/almox/${hid}/ajustes`, { method: "POST", body: b }),
  contagens: (hid) => req(`/almox/${hid}/contagens`),
  contagem: (hid, id) => req(`/almox/${hid}/contagens/${id}`),
  criarContagem: (hid, b) => req(`/almox/${hid}/contagens`, { method: "POST", body: b }),
};
