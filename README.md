# Stock Suite — Par Stock (Loja/PDV) + Almoxarifado (ERP), unificados

Um **único aplicativo cliente-servidor** que junta os dois sistemas em um só login, um só banco e um só visual:

- **Loja · Par Stock** — contagem diária, conciliação de vendas, cálculo de perdas/sobras, reposição e validação por PDV de cada hotel.
- **Almoxarifado · ERP** — estoque central multi-hotel: itens, entradas (custo médio ponderado), requisições com **aprovação**, kardex, ajustes, contagem de inventário, cadastros e relatórios.

E, principalmente, a **integração** entre os dois: na aba **Reposição** da loja, o botão **"Enviar ao almoxarifado"** cria uma **requisição pendente** no ERP, notifica quem aprova e — na aprovação — lança automaticamente a quantidade real liberada como **Reposto** na conciliação da loja.

Front-end em **React + Vite**, back-end em **Node.js + Express**, dados em **PostgreSQL** (produção) ou **SQLite** (local). Autenticação **JWT** + **bcrypt**. Modo claro/escuro em tudo.

Desenvolvido por **Rafael Almeida** · rafael.almeida@accor.com

---

## Como o fluxo integrado funciona

1. O **supervisor** faz a contagem do dia no PDV. Os itens abaixo do mínimo aparecem na aba **Reposição**.
2. Ele clica em **"Enviar ao almoxarifado"**. Um modal mostra cada produto da loja já **vinculado** ao item correspondente do almoxarifado (o vínculo é sugerido por nome e fica salvo para as próximas vezes) e a quantidade a repor.
3. Ao confirmar, é criada uma **requisição** (`REQ-####`, origem "Reposição do PDV …") com status **pendente**. Administradores e o pessoal do **almoxarifado** do hotel recebem uma **notificação** (o sino no topo).
4. O **almoxarifado** abre a requisição, informa a **quantidade real** que saiu de cada item e **aprova**. Nesse momento:
   - o **estoque do ERP é abatido** (com custo médio, registrado no **kardex**);
   - a quantidade real entra **automaticamente como "Reposto"** no dia daquele PDV na loja;
   - quem enviou recebe a **notificação de aprovação** e a tela de reposição se atualiza sozinha.
5. Se a requisição for **rejeitada**, o solicitante é notificado com o **motivo** e nada é movimentado.

Enquanto a requisição está pendente, o botão fica travado (evita envios duplicados para o mesmo dia) e uma barra de status mostra o andamento.

---

## Perfis de acesso

| Perfil | Módulo | Pode |
| --- | --- | --- |
| **Administrador** | Loja + Almoxarifado | Tudo: hotéis, PDVs, usuários e todas as ações dos dois módulos. |
| **Gerente** | Loja | Operação da loja, edita dias retroativos e **valida** conciliações. Cria PDVs. |
| **Supervisor de A&B** | Loja | Operação do dia a dia; ao salvar, a conciliação fica aguardando validação. Envia reposição ao almoxarifado. |
| **Almoxarifado** | Almoxarifado | Estoque, entradas, cadastros, ajustes, contagem e **aprova/rejeita** requisições. |
| **Atendente** | Almoxarifado | Cria requisições (entram como pendentes); vê painel, requisições e kardex. |

- Perfis de um só módulo entram direto nele. **Administrador** escolhe entre **Loja** e **Almoxarifado** ao abrir um hotel.
- O **sino de notificações** e a navegação por clique funcionam em qualquer tela, levando direto à requisição/reposição certa.
- Primeiro start cria um administrador: **login `admin` / senha `rafa1411`** (troque após o primeiro acesso). Usuários criados pelo admin trocam a senha no 1º login.

---

## Rodando localmente

Pré-requisitos: **Node.js 18+** (recomendado 20+).

```bash
# 1. dependências
npm install
#   Se o build do módulo nativo do SQLite falhar (sem python/make/g++),
#   instale sem ele e use o SQLite embutido do Node:
#   npm install --ignore-scripts

# 2. variáveis (opcional em local): defina um JWT_SECRET
#    para manter a sessão após reiniciar.

# 3. compilar a interface
npm run build

# 4. iniciar
npm start                 # usa better-sqlite3 se disponível
#   ou, com o SQLite embutido do Node (sem módulo nativo):
npm run start:builtin
```

Acesse `http://localhost:3000`.

Desenvolvimento com hot reload: `npm run dev` (API na 3000, Vite na 5173 com proxy `/api`).

---

## Deploy (Render + PostgreSQL/Neon)

> Em nuvem o disco é efêmero. Use **PostgreSQL** definindo `DATABASE_URL` — sem isso, cai no SQLite local e os dados se perdem a cada reinício.

1. Suba este repositório no GitHub.
2. No Render: **New → Blueprint** apontando para o repo (o `render.yaml` cria o Postgres e o web service, com `DATABASE_URL` ligado e `JWT_SECRET` gerado).
3. Ou manualmente: Build `npm install && npm run build`, Start `npm start`, e defina `DATABASE_URL` (string *pooled* do Neon) e um `JWT_SECRET` forte.

As tabelas são criadas automaticamente no primeiro start, tanto no Postgres quanto no SQLite.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | *(vazio)* | PostgreSQL (produção). Sem ela, usa SQLite. |
| `JWT_SECRET` | *(aleatório)* | Segredo dos tokens. **Defina em produção.** |
| `DATABASE_PATH` | `./data/parstock.db` | Caminho do SQLite local. |
| `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD` | `admin` / `rafa1411` | Admin criado no 1º start. |
| `PORT` | `3000` | Porta do servidor. |
| `TOKEN_TTL` | `12h` | Validade do token. |
| `CORS_ORIGIN` | *(vazio)* | Domínios liberados (se front e API ficarem separados). |

---

## Migrando dos sistemas antigos

- **Par Stock:** o esquema da loja é o mesmo do sistema original (tabelas `users`, `hotels`, `pdvs`, `products`, `days`). Apontando o `DATABASE_URL` para o **mesmo banco** do Par Stock atual, **os dados existentes continuam funcionando** e ganham o módulo de almoxarifado por cima.
- **Almoxarifado (Almoxa) antigo:** era um banco separado com esquema próprio. Os dados de estoque precisam ser **recadastrados** ou **importados** — a aba **Itens** do almoxarifado tem **importação por Excel** (com modelo para baixar) que cria os itens já com estoque inicial e mínimo. **Hotéis** e **usuários** passam a ser os mesmos da loja (um cadastro só para os dois módulos).

---

## Estrutura

```
server/
  index.js              # app Express, segurança, arquivos estáticos, monta as rotas
  db.js                 # conexão (PG/SQLite), schema unificado e seed do admin
  auth.js               # JWT + bcrypt + middlewares
  helpers.js            # perfis, módulos e regras de escopo por hotel
  routes/
    auth.js  users.js  catalog.js       # login, usuários, hotéis/PDVs
    days.js                             # loja: contagem/conciliação/validação + envio de reposição
    almox.js                            # almoxarifado: itens, entradas, requisições, kardex, ajustes, contagem
    notif.js                            # notificações (sino)
  public/               # build do front (gerado por "npm run build")
client/
  src/
    App.jsx             # loja (Par Stock) + seletor de módulos + sino + navegação
    AlmoxModule.jsx     # módulo Almoxarifado (ERP) em React, mesmo design system
    api.js              # cliente HTTP (loja + almoxarifado + notificações)
```

## Segurança

- Senhas só como **hash bcrypt**; sessões via **JWT** assinado.
- Autorização por perfil e por hotel validada **no servidor** em todas as rotas.
- `helmet`, `compression` e **rate limit** no login já configurados. Sirva sempre atrás de **HTTPS** em produção.

---

Desenvolvido por **Rafael Almeida** — rafael.almeida@accor.com
