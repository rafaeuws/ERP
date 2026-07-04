/* ============================================================
   CSS do módulo Almoxarifado (ERP) — layout ORIGINAL (menu lateral).
   Baseado no styles.css do sistema Almoxarifado Cloud, com adições
   para notificações, origem "loja" e impressão de documentos.
   ============================================================ */
export const ALMOX_CSS = `
.almox-root{
  --primary:#0E5C4A; --primary-600:#0A4A3B; --primary-soft:#E3F0EC; --primary-700:#072e25;
  --in:#1B7A3D; --in-soft:#E4F4E9; --out:#BE3A2B; --out-soft:#FBE9E7; --warn:#B97608; --warn-soft:#FBF0DD;
  --ink:#15211D; --ink-soft:#3D4A45; --ink-faint:#7A8783; --line:#E6ECEA; --line-strong:#D2DAD7;
  --bg:#F5F7F6; --surface:#FFFFFF; --surface-2:#F0F4F2; --surface-3:#E9EFEC;
  --ui:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif; --mono:'IBM Plex Mono',ui-monospace,monospace;
  --shadow:0 1px 2px rgba(16,32,28,.06),0 2px 8px rgba(16,32,28,.04); --radius:12px;
  font-family:var(--ui);color:var(--ink);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;
}
[data-theme="dark"] .almox-root{
  --primary:#23a585; --primary-600:#1c8b70; --primary-700:#0e5c4a; --primary-soft:#16322b;
  --in:#4cc587; --in-soft:#143020; --out:#ef6a5a; --out-soft:#3a1d18; --warn:#e2ab44; --warn-soft:#352a16;
  --ink:#e8efec; --ink-soft:#b6c4be; --ink-faint:#869089;
  --line:#243430; --line-strong:#31453f;
  --bg:#0e1513; --surface:#16211d; --surface-2:#1c2925; --surface-3:#24332e;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 2px 8px rgba(0,0,0,.3);
}
.almox-root *{box-sizing:border-box;margin:0;padding:0}
.almox-root a{color:var(--primary);text-decoration:none}
.almox-root .ic{width:18px;height:18px;flex:none}
.almox-root .ic-sm{width:13px;height:13px}
.almox-root .mono{font-family:var(--mono)}
.almox-root .spacer{flex:1}
.almox-root .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.almox-root .t-sub{color:var(--ink-faint);font-size:12.5px}
.almox-root .t-code{font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
.almox-root .t-desc{font-weight:600;font-size:13.5px}
.almox-root .num{text-align:right;font-family:var(--mono)}
.almox-root .req{color:var(--out)}
.almox-root .section-title{font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-faint);margin:22px 0 10px}
.almox-root .hint{font-size:12px;color:var(--ink-faint);margin-top:6px}

/* Botões */
.almox-root .btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);
  padding:9px 14px;border-radius:9px;font-weight:600;font-size:13px;cursor:pointer;transition:transform .08s,background .15s,border-color .15s}
.almox-root .btn:hover{background:var(--surface-2)} .almox-root .btn:active{transform:translateY(1px)}
.almox-root .btn:disabled{opacity:.55;cursor:default}
.almox-root .btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.almox-root .btn.primary:hover{background:var(--primary-600)}
.almox-root .btn.danger{color:var(--out);border-color:#EAC6C1} .almox-root .btn.danger:hover{background:var(--out-soft)}
.almox-root .btn.sm{padding:5px 10px;font-size:12px}
.almox-root .icon-btn{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--ink-soft);cursor:pointer}
.almox-root .icon-btn:hover{background:var(--surface-2);color:var(--ink)} .almox-root .icon-btn.danger:hover{background:var(--out-soft);color:var(--out)}
.almox-root .filebtn{position:relative;overflow:hidden}
.almox-root .filebtn input{position:absolute;inset:0;opacity:0;cursor:pointer}

/* Pills */
.almox-root .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:11.5px;font-weight:600}
.almox-root .pill.ok{background:var(--in-soft);color:var(--in)} .almox-root .pill.low{background:var(--warn-soft);color:var(--warn)}
.almox-root .pill.zero{background:var(--out-soft);color:var(--out)} .almox-root .pill.in{background:var(--in-soft);color:var(--in)}
.almox-root .pill.out{background:var(--out-soft);color:var(--out)} .almox-root .pill.adj{background:var(--warn-soft);color:var(--warn)}
.almox-root .pill.muted{background:var(--surface-3);color:var(--ink-faint)} .almox-root .pill.par{background:var(--primary-soft);color:var(--primary)}
.almox-root .pill.pend{background:var(--warn-soft);color:var(--warn)} .almox-root .pill.aprov{background:var(--in-soft);color:var(--in)} .almox-root .pill.rej{background:var(--out-soft);color:var(--out)}
.almox-root .pill.loja{background:var(--primary-soft);color:var(--primary)}
.almox-root .badge{margin-left:auto;background:var(--surface-3);color:var(--ink-faint);font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px}
.almox-root .badge.warn{background:var(--warn);color:#fff}

/* App shell */
.almox-root .app{display:grid;grid-template-columns:248px 1fr;grid-template-rows:auto 1fr auto;grid-template-areas:"side top" "side main" "side foot";height:100vh;background:var(--bg)}
.almox-root .sidebar{grid-area:side;background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;overflow-y:auto}
.almox-root .brand{display:flex;align-items:center;gap:10px;padding:18px 18px 14px;border-bottom:1px solid var(--line)}
.almox-root .brand .mk{width:36px;height:36px;border-radius:9px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:700}
.almox-root .brand h1{font-size:15px;letter-spacing:-.2px}.almox-root .brand p{font-size:11px;color:var(--ink-faint)}
.almox-root .nav{padding:10px 10px 16px;flex:1}
.almox-root .nav .group{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-faint);font-weight:700;padding:14px 10px 6px}
.almox-root .nav a{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;color:var(--ink-soft);font-weight:500;font-size:13.5px;cursor:pointer;margin-bottom:1px}
.almox-root .nav a:hover{background:var(--surface-2);color:var(--ink)}
.almox-root .nav a.active{background:var(--primary-soft);color:var(--primary);font-weight:600}
.almox-root .topbar{grid-area:top;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;padding:0 22px;height:60px}
.almox-root .topbar .crumb{font-size:12px;color:var(--ink-faint)} .almox-root .topbar h2{font-size:16px}
.almox-root .help-btn{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);border:1px solid var(--line-strong);color:var(--ink-soft);font-weight:700;cursor:pointer}
.almox-root .help-btn:hover{background:var(--surface-3);color:var(--ink)}
.almox-root .user-chip{display:flex;align-items:center;gap:9px;padding:5px 6px 5px 9px;border:1px solid var(--line);border-radius:24px}
.almox-root .user-chip .avatar{width:30px;height:30px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:600;font-size:13px}
.almox-root .user-chip .uname{font-size:12.5px;font-weight:600;line-height:1.1}.almox-root .user-chip .urole{font-size:10.5px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.4px}
.almox-root .menu-btn{display:none;width:34px;height:34px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font-size:17px;cursor:pointer}
.almox-root .content{grid-area:main;overflow-y:auto;padding:24px}
.almox-root .appfoot{grid-area:foot;border-top:1px solid var(--line);background:var(--surface);padding:10px 22px;font-size:12px;color:var(--ink-faint);display:flex;align-items:center;gap:8px}
.almox-root .appfoot a{font-weight:600}

/* Cards / KPIs / tabelas */
.almox-root .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.almox-root .kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.almox-root .kpi .accent{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--primary)}
.almox-root .kpi.warn .accent{background:var(--warn)} .almox-root .kpi.out .accent{background:var(--out)} .almox-root .kpi.money .accent{background:var(--in)}
.almox-root .kpi .label{font-size:11.5px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.4px;font-weight:600}
.almox-root .kpi .val{font-size:26px;font-weight:700;font-family:var(--mono);margin-top:4px}
.almox-root .kpi .foot{font-size:11.5px;color:var(--ink-faint);margin-top:2px}
.almox-root .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.almox-root .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;margin-bottom:16px}
.almox-root .card-head{display:flex;align-items:center;gap:9px;padding:14px 16px;border-bottom:1px solid var(--line)}
.almox-root .card-head h3{font-size:14px} .almox-root .card-body{padding:16px}
.almox-root .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.almox-root .search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line-strong);border-radius:9px;padding:8px 11px;flex:1;min-width:200px;max-width:380px}
.almox-root .search input{border:none;outline:none;flex:1;font-size:13px;background:transparent;color:var(--ink)}
.almox-root .filter{border:1px solid var(--line-strong);border-radius:9px;padding:8px 11px;background:var(--surface);font-size:13px;color:var(--ink)}
.almox-root .tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.almox-root table{width:100%;border-collapse:collapse;font-size:13px}
.almox-root thead th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink-faint);font-weight:700;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--surface-2);white-space:nowrap}
.almox-root thead th.r{text-align:right}
.almox-root tbody td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.almox-root tbody tr:last-child td{border-bottom:none} .almox-root tbody tr:hover{background:var(--surface-2)}
.almox-root .actions-cell{text-align:right;white-space:nowrap}
.almox-root .empty{display:grid;place-items:center;text-align:center;padding:48px 20px;color:var(--ink-faint)}
.almox-root .empty h4{color:var(--ink);font-size:15px;margin:10px 0 4px}.almox-root .empty p{max-width:360px;margin-bottom:14px}
.almox-root .diverg{font-family:var(--mono);font-weight:600}
.almox-root .diverg.neg{color:var(--out)}.almox-root .diverg.pos{color:var(--in)}.almox-root .diverg.zero{color:var(--ink-faint)}
.almox-root .mv-in{color:var(--in)}.almox-root .mv-out{color:var(--out)}.almox-root .mv-adj{color:var(--warn)}
.almox-root .abc-A,.almox-root .abc-B,.almox-root .abc-C{display:inline-block;min-width:20px;text-align:center;padding:1px 7px;border-radius:6px;font-weight:700;font-size:11px}
.almox-root .abc-A{background:var(--out-soft);color:var(--out)}.almox-root .abc-B{background:var(--warn-soft);color:var(--warn)}.almox-root .abc-C{background:var(--in-soft);color:var(--in)}
.almox-root .tag{display:inline-block;background:var(--surface-3);color:var(--ink-soft);font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:20px}
.almox-root .report-card{cursor:pointer;transition:transform .12s,border-color .15s;margin-bottom:0}
.almox-root .report-card:hover{transform:translateY(-2px);border-color:var(--primary)}
.almox-root .bar-track{height:8px;background:var(--surface-3);border-radius:4px;overflow:hidden}
.almox-root .bar-fill{height:100%;background:var(--out)}

/* Forms */
.almox-root .field{margin-bottom:14px}
.almox-root .field label{display:block;font-size:12.5px;font-weight:600;color:var(--ink-soft);margin-bottom:5px}
.almox-root .field input,.almox-root .field select,.almox-root .field textarea{width:100%;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;font-size:13.5px;font-family:var(--ui);background:var(--surface);color:var(--ink)}
.almox-root .field input:focus,.almox-root .field select:focus,.almox-root .field textarea:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.almox-root .field input:disabled{background:var(--surface-2);color:var(--ink-faint)}
.almox-root .field-row{display:grid;gap:12px}.almox-root .field-row.c2{grid-template-columns:1fr 1fr}
.almox-root .hotel-check{display:grid;grid-template-columns:1fr 1fr;gap:9px;max-height:170px;overflow:auto;border:1px solid var(--line-strong);border-radius:8px;padding:11px}
.almox-root .hcheck{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;cursor:pointer}.almox-root .hcheck input{width:auto;margin:0}
.almox-root .detail-list .dl-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px dashed var(--line)}
.almox-root .dl-k{color:var(--ink-faint);font-size:12.5px}.almox-root .dl-v{font-weight:600;text-align:right}
.almox-root .li-head{display:grid;gap:8px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--ink-faint);font-weight:700;margin-bottom:6px}
.almox-root .li-row{display:grid;gap:8px;margin-bottom:8px;align-items:center}
.almox-root .li-row input,.almox-root .li-row select{padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--ui);font-size:13px}
.almox-root .li-row .stk{font-family:var(--mono);font-size:12.5px;color:var(--ink-faint);align-self:center}

/* Modal + toast */
.almox-root .overlay{position:fixed;inset:0;background:rgba(16,32,28,.45);display:flex;align-items:center;justify-content:center;z-index:120;padding:20px}
.almox-root .modal{background:var(--surface);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.3);width:100%;max-width:480px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
.almox-root .modal.wide{max-width:720px}
.almox-root .modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)}
.almox-root .modal-head h3{font-size:16px}.almox-root .modal-body{padding:20px;overflow-y:auto}
.almox-root .modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:var(--surface-2)}
.almox-root .modal-err{background:var(--out-soft);color:var(--out);border-radius:8px;padding:9px 12px;font-size:12.5px;font-weight:600;margin-bottom:12px}

.almox-root .toasts{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:200}
.almox-root .toast{background:var(--ink);color:#fff;padding:11px 16px;border-radius:10px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:340px}
[data-theme="dark"] .almox-root .toast{background:#24332e}
.almox-root .toast.ok{background:var(--in)}.almox-root .toast.warn{background:var(--warn)}.almox-root .toast.err{background:var(--out)}

/* Tema (sol/lua) */
.almox-root .theme-btn{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);
  border:1px solid var(--line-strong);color:var(--ink-soft);cursor:pointer;font-size:15px;line-height:1;transition:background .15s,color .15s,transform .12s}
.almox-root .theme-btn:hover{color:var(--ink);background:var(--surface-3)}
.almox-root .theme-btn:active{transform:scale(.92)}

/* Sino de notificações */
.almox-root .bellwrap{position:relative}
.almox-root .bell{position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);border:1px solid var(--line-strong);color:var(--ink-soft);cursor:pointer;font-size:15px}
.almox-root .bell:hover{background:var(--surface-3);color:var(--ink)}
.almox-root .bell-n{position:absolute;top:-4px;right:-4px;background:var(--out);color:#fff;border-radius:999px;font-size:10px;font-weight:700;min-width:16px;height:16px;display:grid;place-items:center;padding:0 4px}
.almox-root .notifov{position:fixed;inset:0;z-index:130}
.almox-root .notifpanel{position:absolute;right:0;top:44px;width:344px;max-width:88vw;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 44px rgba(16,32,28,.24);z-index:131;overflow:hidden}
.almox-root .notifhead{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid var(--line);font-size:13px}
.almox-root .notiflist{max-height:min(60vh,440px);overflow:auto}
.almox-root .notifitem{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line);padding:11px 13px;cursor:pointer;color:var(--ink)}
.almox-root .notifitem:last-child{border-bottom:none}.almox-root .notifitem:hover{background:var(--surface-2)}
.almox-root .notifitem.unread{background:var(--primary-soft)}
.almox-root .notif-t{font-weight:700;font-size:12.5px}.almox-root .notif-c{font-size:12px;color:var(--ink-faint);margin-top:2px}
.almox-root .notif-d{font-size:10.5px;color:var(--ink-faint);margin-top:3px;text-transform:uppercase;letter-spacing:.4px}
.almox-root .link-btn,.almox-root .crumb-link{background:none;border:none;color:var(--primary);font:inherit;cursor:pointer;font-size:11.5px;font-weight:600}
.almox-root .bell-i{font-size:15px;line-height:1}

/* Avisos */
.almox-root .statusbar{border-radius:10px;padding:11px 14px;font-size:13px;margin-bottom:16px}
.almox-root .statusbar.ok{background:var(--in-soft);color:var(--in);border:1px solid var(--in)}
.almox-root .statusbar.warn{background:var(--warn-soft);color:var(--warn);border:1px solid var(--warn)}

/* Impressão de documentos */
.almox-root .print-head{display:none}
.almox-root .sign-row{display:flex;gap:40px;justify-content:space-around;margin-top:40px;flex-wrap:wrap}
.almox-root .sign-box{flex:1;max-width:280px;min-width:180px;text-align:center}
.almox-root .sign-line{border-bottom:1.5px solid var(--ink);height:34px}
.almox-root .sign-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-faint);margin-top:7px;font-weight:700}
.almox-root .only-print{display:none}
.almox-root .cline{display:inline-block;width:70px;height:14px;border-bottom:1px solid var(--ink-faint)}

@media(max-width:860px){
  .almox-root .app{grid-template-columns:1fr;grid-template-areas:"top" "main" "foot"}
  .almox-root .sidebar{position:fixed;left:0;top:0;bottom:0;width:248px;z-index:60;transform:translateX(-100%);transition:transform .2s;box-shadow:0 10px 40px rgba(0,0,0,.2)}
  .almox-root .sidebar.open{transform:none}
  .almox-root .menu-btn{display:grid;place-items:center}
  .almox-root .kpis{grid-template-columns:1fr 1fr}.almox-root .grid-2{grid-template-columns:1fr}.almox-root .field-row.c2{grid-template-columns:1fr}
}

@media print{
  .no-print{display:none !important}
  body *{visibility:hidden}
  .almox-root .print-zone,.almox-root .print-zone *{visibility:visible}
  .almox-root .print-zone{position:absolute;left:0;top:0;width:100%;padding:0}
  .almox-root .overlay{position:static;background:none;padding:0;display:block}
  .almox-root .modal{max-width:none;max-height:none;box-shadow:none;border:none;display:block}
  .almox-root .modal-body{overflow:visible;padding:0}
  .almox-root .print-head{display:flex;gap:12px;align-items:center;padding:0 0 12px;border-bottom:2px solid #0E5C4A;margin-bottom:14px}
  .almox-root .print-mk{width:40px;height:40px;border-radius:9px;background:#0E5C4A;color:#fff;display:grid;place-items:center;font-weight:700}
  .almox-root .only-print{display:block}
  .almox-root .app{display:block;height:auto;overflow:visible}
  .almox-root .content{overflow:visible;padding:0}
}
`;
