# ☕ Cafezal CRM

CRM web multi-utente per il team commerciale Cafezal (Laura, Massimo, Gabriele):
pipeline vendite kanban con drag & drop, CRUD opportunità, filtri, assegnazioni e
un **reminder email giornaliero** automatico.

| Layer        | Tecnologia                                   |
| ------------ | -------------------------------------------- |
| Frontend     | React + Vite + TailwindCSS + @dnd-kit        |
| Backend      | Node.js + Express + nodemailer + node-cron   |
| Database/Auth| Supabase (PostgreSQL + Auth)                 |
| Deploy       | Vercel (frontend) + Railway/Render o Vercel (backend) |

---

## 📁 Struttura del repository

```
cafezal-crm/
├── supabase/
│   ├── schema.sql          # tabella opportunities, enum, trigger, indici
│   ├── rls.sql             # Row Level Security (opzionale, hardening)
│   └── seed.sql            # dati demo
├── server/                 # API Express + scheduler reminder
│   ├── src/
│   │   ├── index.js        # entry (server persistente + cron in-process)
│   │   ├── app.js          # Express app factory
│   │   ├── config/         # env + client Supabase
│   │   ├── middleware/     # verifica JWT Supabase
│   │   ├── routes/         # /api/opportunities, /api/me, /api/cron
│   │   ├── controllers/    # handler richieste
│   │   ├── services/       # logica CRUD + reminder
│   │   ├── lib/            # mailer, template email, costanti, ruoli
│   │   └── scheduler/      # node-cron (09:00 Europe/Rome)
│   ├── api/index.js        # entry serverless per Vercel
│   ├── scripts/create-users.mjs   # crea i 3 account
│   ├── vercel.json         # config Vercel + Vercel Cron
│   └── .env.example
└── client/                 # SPA React
    ├── src/
    │   ├── pages/          # Login, Dashboard
    │   ├── components/     # KanbanBoard, Card, Modal, Filters, Layout…
    │   ├── context/        # AuthContext (sessione Supabase)
    │   └── lib/            # supabaseClient, api, costanti
    ├── vercel.json         # rewrite SPA
    └── .env.example
```

---

## ✅ Prerequisiti

- **Node.js ≥ 18**
- Un account **[Supabase](https://supabase.com)** (free tier OK)
- (Per le email reali) credenziali **SMTP** — es. SendGrid, Mailgun, Gmail App Password, Postmark…

---

## 🚀 Setup in locale (5 passi)

### 1) Clona e installa

```bash
git clone <REPO_URL> cafezal-crm
cd cafezal-crm
npm run install:all        # installa server/ e client/
```

### 2) Crea il progetto Supabase + schema

1. Crea un nuovo progetto su [app.supabase.com](https://app.supabase.com).
2. Vai su **SQL Editor → New query**, incolla il contenuto di
   [`supabase/schema.sql`](supabase/schema.sql) ed esegui (**Run**).
3. (Opzionale) Esegui [`supabase/seed.sql`](supabase/seed.sql) per dati demo.
4. (Opzionale, hardening) Esegui [`supabase/rls.sql`](supabase/rls.sql).
5. Da **Project Settings → API** copia:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` (segreta!) → `SUPABASE_SERVICE_ROLE_KEY`

### 3) Configura le variabili d'ambiente

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
# poi compila i valori Supabase (e SMTP se vuoi inviare email reali)
```

> ⚠️ La `service_role` key è un segreto: **solo nel backend**, mai nel frontend né nel repo.

### 4) Crea i 3 account commerciali

Modo automatico (consigliato), dopo aver compilato `server/.env`:

```bash
npm run seed:users
```

Crea `laura@cafezal.com`, `massimo@cafezal.com`, `gabriele@cafezal.com`
(+ admin se imposti `SEED_ADMIN_EMAIL`) con password `SEED_USER_PASSWORD`
(default `Cafezal2026!`).

> In alternativa: Supabase **Authentication → Users → Add user** (spunta *Auto Confirm User*).

### 5) Avvia

In due terminali separati:

```bash
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173
```

Apri **http://localhost:5173**, accedi con uno dei 3 account.

---

## 👥 Autenticazione e ruoli

- Login **email/password** via Supabase Auth (gestito dal frontend).
- Il frontend invia il JWT Supabase nell'header `Authorization: Bearer <token>`;
  l'API Express lo verifica ad ogni richiesta.
- **Visibilità (pool condiviso)**: ogni commerciale vede **le proprie** opportunità
  **+ il pool** (lead non assegnati), e può **prendersele in carico** dalla modale
  ("Prendi in carico"). Non vede i lead già di un altro commerciale.
  Un **admin** (email in `ADMIN_EMAILS`, default `admin@cafezal.com`) vede **tutto**.
- Mappatura identità → commerciale (in `server/src/lib/constants.js` e lato client).
  Login con l'account `@cafezal.com` *oppure* con l'indirizzo reale `@cafezal.it`:

  | Login (.com / .it)                    | Commerciale | Reminder inviato a       |
  | ------------------------------------- | ----------- | ------------------------ |
  | laura@cafezal.com / laura@cafezal.it  | Laura       | laura@cafezal.it *(placeholder)* |
  | massimo@cafezal.com / m.rotunno@cafezal.it | Massimo | m.rotunno@cafezal.it     |
  | gabriele@cafezal.com / sales@cafezal.it | Gabriele  | sales@cafezal.it         |

L'autorizzazione è applicata **lato server** (service role + controlli di scope).
`supabase/rls.sql` aggiunge protezione anche a livello DB (opzionale).

---

## 📧 Reminder email giornaliero

Ogni giorno alle **09:00 (Europe/Rome, gestisce ora legale/solare)** il sistema invia
a **ciascun commerciale** una email:

- **Subject:** `Recap Giornaliero - Cafezal CRM`
- **Body (HTML):**
  - tabella delle opportunità **in scadenza nei prossimi 3 giorni** (configurabile
    con `REMINDER_DAYS_AHEAD`, esclude fasi `Chiuso`/`K.O.`)
  - **recap pipeline per fase** (conteggio opportunità per ogni fase)

Due modalità di scheduling (a seconda del deploy del backend):

1. **Server persistente** (locale, Railway, Render): `node-cron` in-process,
   timezone-aware. Nessuna configurazione extra. Vedi `server/src/scheduler/`.
2. **Serverless / Vercel**: usa **Vercel Cron** (`server/vercel.json`) che chiama
   `GET /api/cron/daily-reminder`. Vercel Cron usa **UTC**: `0 7 * * *` ≈ 09:00 ora
   legale italiana (in inverno diventa 08:00). Per orario esatto tutto l'anno, preferisci
   la modalità 1.

**Test manuale** del job (senza aspettare le 09:00):

```bash
curl -X POST http://localhost:4000/api/cron/daily-reminder \
  -H "x-cron-secret: <CRON_SECRET>"
```

> Senza `SMTP_HOST` configurato, le email vengono **loggate in console** invece di
> essere inviate — comodo per provare in locale.

### ✉️ Attivazione email reali in produzione (Vercel)

Reminder giornaliero **e** report mensile vengono **inviati davvero** solo quando il
backend ha le variabili SMTP. Mittente sempre **`m.rotunno@cafezal.it`** (Google Workspace).

Sul progetto Vercel del **backend** → **Settings → Environment Variables**:

| Variabile     | Valore                                  |
| ------------- | --------------------------------------- |
| `SMTP_HOST`   | `smtp.gmail.com`                        |
| `SMTP_PORT`   | `587`                                   |
| `SMTP_SECURE` | `false`                                 |
| `SMTP_USER`   | `m.rotunno@cafezal.it`                  |
| `SMTP_PASS`   | *App Password Google* (segna **Sensitive**) |
| `MAIL_FROM`   | `Cafezal CRM <m.rotunno@cafezal.it>`    |
| `CRON_SECRET` | *stringa casuale* (consigliata)         |

**App Password Google** (per `SMTP_PASS`):

1. L'account `m.rotunno@cafezal.it` deve avere la **verifica in 2 passaggi** attiva.
2. Vai su <https://myaccount.google.com/apppasswords>, crea una password per l'app "Mail".
3. Incolla le 16 cifre (senza spazi) in `SMTP_PASS`.

Poi **Redeploy** del backend. Destinatari reminder: Laura → `laura@cafezal.it` (placeholder),
Massimo → `m.rotunno@cafezal.it`, Gabriele → `sales@cafezal.it`.

---

## 📈 Report mensile

Il **1° di ogni mese** (Vercel Cron `0 7 1 * *` ≈ 09:00 ITA) viene inviato a
**`carlos@cafezal.it`** (`REPORT_TO`) un report sintetico del mese precedente:

- quadro generale (totale lead, pool, assegnati, attivi, chiusi, K.O.);
- tabella **per commerciale** (assegnati, attivi, chiusi, K.O., lavorati nel mese, win rate);
- pipeline per fase e top categorie.

Test manuale: `GET /api/cron/monthly-report` (protetto da `CRON_SECRET`).

---

## 📥 Import CSV in-app (admin)

L'admin può importare lead dal pulsante **Importa** in dashboard (`POST /api/opportunities/import`):

- intestazioni riconosciute (1ª riga): **Azienda** (obbligatoria), Categoria, Commerciale,
  Fase, Sensibility, Kg, Scadenza, Note, Macchina;
- separatore virgola o punto e virgola, valori con virgolette gestiti;
- valori non validi normalizzati (es. fase → `Lead`), lead senza commerciale → **pool**;
- opzione **salta duplicati** per nome azienda.

---

## 🔌 API REST

Base URL: `<VITE_API_BASE_URL>/api`. Tutte le rotte (tranne `/health` e `/cron`)
richiedono `Authorization: Bearer <supabase_jwt>`.

| Metodo | Endpoint                      | Descrizione                                  |
| ------ | ----------------------------- | -------------------------------------------- |
| GET    | `/health`                     | Healthcheck                                  |
| GET    | `/me`                         | Profilo: `{ email, commerciale, isAdmin }`   |
| GET    | `/opportunities`              | Lista (scoped, **tutte** le righe via paginazione). Query: `commerciale`, `categoria`, `fase`, `sensibility` |
| POST   | `/opportunities`              | Crea opportunità                             |
| POST   | `/opportunities/import`       | **Import CSV massivo (solo admin)**          |
| GET    | `/opportunities/:id`          | Dettaglio                                    |
| PATCH  | `/opportunities/:id`          | Aggiorna (parziale)                          |
| DELETE | `/opportunities/:id`          | Elimina                                      |
| POST/GET | `/cron/daily-reminder`      | Esegue il job reminder (protetto da `CRON_SECRET`) |
| POST/GET | `/cron/monthly-report`      | Report mensile a `carlos@cafezal.it` (protetto da `CRON_SECRET`) |

Esempio creazione:

```bash
curl -X POST http://localhost:4000/api/opportunities \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"azienda":"Bar Roma","commerciale_assegnato":"Laura","fase_pipeline":"Lead","sensibility":"mid","data_scadenza":"2026-06-15"}'
```

---

## ☁️ Deploy

### Frontend → Vercel

1. Importa il repo su Vercel, **Root Directory = `client`**.
2. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_API_BASE_URL` (URL del backend), `VITE_ADMIN_EMAILS` (opzionale).
4. `client/vercel.json` gestisce il rewrite SPA.

### Backend — opzione A: Railway / Render (consigliata)

Server Express persistente → lo scheduler `node-cron` gira nativo, orario esatto.

1. Nuovo servizio dal repo, **Root = `server`**, start command `npm start`.
2. Imposta tutte le env di `server/.env.example`.
3. `CLIENT_ORIGIN` = URL del frontend Vercel (per la CORS).

### Backend — opzione B: Vercel (serverless)

1. Secondo progetto Vercel, **Root Directory = `server`**.
2. Env come sopra. `server/vercel.json` espone `api/index.js` e configura **Vercel Cron**.
3. ⚠️ In serverless lo scheduler in-process non gira: il reminder è gestito da Vercel Cron
   (UTC). Imposta anche `CRON_SECRET` (Vercel Cron invia `Authorization: Bearer <secret>`
   se configuri il secret come *Cron Secret* del progetto).

> Imposta `CLIENT_ORIGIN` sul backend con l'origine del frontend per evitare errori CORS.

---

## 🎨 Funzionalità

- **Dashboard kanban** con 6 colonne (Lead → Contattato → In trattativa → Proposta →
  Chiuso / K.O.) e **drag & drop** (mouse + touch) per spostare le opportunità di fase.
- **CRUD** completo via modale (crea, modifica, elimina).
- **Pool condiviso**: lead non assegnati visibili a tutti, con "Prendi in carico".
- **Categorie** lead (Hotel, Caffè/Bakery IT/Estero, Ristoranti, Agenzie, Startup,
  Corporate, Moda/Design, Meta Lead) con **tag colorato** e filtro dedicato.
- **Ricerca** per azienda + **stat strip** (totale, pool, assegnati, conclusi) sui
  **~1.900 lead** reali (paginazione oltre il limite 1000 di PostgREST).
- **Filtri** per commerciale (admin), categoria, fase e sensibility.
- **Profilo personale** con **cambio password** (`/profilo`).
- **Import CSV in-app** (admin) e **report mensile** automatico al management.
- **Reminder email** giornaliero per ogni commerciale.
- **Badge** sensibility, indicatore scadenza, **UI responsive/mobile** (bottom-sheet).

---

## 🛠️ Troubleshooting

| Problema | Causa / Soluzione |
| -------- | ----------------- |
| `401 Invalid or expired token` | JWT scaduto: rifai login. Verifica `SUPABASE_ANON_KEY` sul server. |
| Board vuota dopo login | Esegui `seed.sql`, o crea opportunità. Se sei commerciale vedi solo le tue. |
| Errori CORS | Imposta `CLIENT_ORIGIN` sul backend con l'URL esatto del frontend. |
| Email non inviate | Senza `SMTP_HOST` vengono solo loggate. Configura le credenziali SMTP. |
| Reminder all'orario sbagliato (Vercel) | Vercel Cron è in UTC: usa la modalità server persistente per l'ora esatta. |
| `Missing required env vars` all'avvio | Compila `server/.env` (URL + chiavi Supabase). |

---

## 📅 Timeline di sviluppo (riferimento briefing)

- **Giorno 1:** schema DB + API backend
- **Giorno 2:** UI frontend
- **Giorno 3:** auth + scheduler reminder
- **Giorno 4:** deploy + testing

---

Made with ☕ for Cafezal.
