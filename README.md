# Radio-backend (Node.js + Express + PostgreSQL)

Een kleine **API** voor een radiostation per gebruiker: inloggen, nummers toevoegen, **nu speelt** bekijken en een **playlist** (laatst gespeelde nummers).

## Begrippen (beginners)

| Wat | Uitleg |
|-----|--------|
| **Express** | Een populaire library voor Node.js om **HTTP-routes** te maken (zoals `GET /now-playing`). |
| **PostgreSQL** | Een **database** waar accounts, stations en nummers worden opgeslagen. Lokaal of op Railway. |
| **Prisma** | Hulpcode tussen Node en PostgreSQL: je beschrijft **tabellen** in `prisma/schema.prisma` en Prisma genereert queries. |
| **Omgevingsvariabelen (.env)** | Geheime instellingen **buiten** je code, zoals database-URL en JWT-secret. Zo kun je lokaal en op Railway andere waarden gebruiken. |
| **JWT-token** | Na inloggen krijg je een **token** (tekst). Stuur die mee als `Authorization: Bearer <token>` bij routes die je station beschermen. |
| **Station** | Bij **registratie** wordt automatisch **één station** aangemaakt en aan jouw account gekoppeld: **1 gebruiker = 1 station**. |
| **Track** | Een nummer met **artiest**, **titel** en optioneel **durationSeconds** (lengte in seconden = “tijd”). |
| **Nu speelt** | Als je **POST /tracks** doet, wordt dat nummer meteen “nu speelt”. Het **vorige** nummer gaat naar de **geschiedenis** (playlist). |

## Vereisten

- [Node.js](https://nodejs.org/) **18 of nieuwer**
- Een **PostgreSQL**-database (lokaal via Docker, of Railway Postgres)

## Lokaal starten

### 1. Packages installeren

```bash
cd /Users/ferryoomen/stack/dashboard
npm install
```

### 2. `.env` aanmaken

Kopieer het voorbeeldbestand en vul je eigen waarden in:

```bash
cp .env.example .env
```

Minimaal nodig:

- `DATABASE_URL` — connection string van PostgreSQL  
- `JWT_SECRET` — minstens 16 tekens (langer en willekeurig is beter)

### 3. Database-schema toepassen

Eenmalig (of na wijzigingen in `prisma/schema.prisma`):

```bash
npx prisma migrate dev
```

Dit maakt de tabellen aan op basis van `prisma/migrations/`.

### 4. Server draaien (development)

```bash
npm run dev
```

Standaard luistert de app op **poort 3000** (tenzij je `PORT` in `.env` zet).

- Gezondheid: [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health)

## API (kort)

| Methode | Pad | Uitleg |
|--------|-----|--------|
| `POST` | `/auth/register` | Account + station aanmaken. Body: `email`, `password`, optioneel `stationName`. Antwoord bevat `token`. |
| `POST` | `/auth/login` | Inloggen. Body: `email`, `password`. Antwoord bevat `token`. |
| `POST` | `/tracks` | Nummer toevoegen **en** meteen als “nu speelt” zetten. Header: `Authorization: Bearer <token>`. Body: `artist`, `title`, optioneel `durationSeconds` (heel getal, seconden). |
| `GET` | `/now-playing` | Huidige track of `null`. Header: Bearer-token. |
| `GET` | `/playlist?limit=20` | Laatst gespeelde nummers (geschiedenis). Header: Bearer-token. |

**Let op:** `/tracks`, `/now-playing` en `/playlist` werken **alleen** met een geldige token (behalve `/health` en `/auth/*`).

## PostgreSQL snel lokaal (Docker)

Als je Docker hebt:

```bash
docker run --name radio-pg -e POSTGRES_PASSWORD=radio -e POSTGRES_DB=radio -p 5432:5432 -d postgres:16
```

Zet in `.env` bijvoorbeeld:

```env
DATABASE_URL="postgresql://postgres:radio@localhost:5432/radio?schema=public"
```

Daarna: `npx prisma migrate dev` en `npm run dev`.

## Deployen op Railway

1. Maak een **nieuw project** op [Railway](https://railway.app/) en koppel deze repo (of push naar GitHub en importeer).
2. Voeg een **PostgreSQL**-plugin toe. Railway vult automatisch **`DATABASE_URL`** in voor je app-service.
3. Zet bij je **Node-service** onder **Variables** minstens:
   - `JWT_SECRET` = een lange willekeurige string (Railway vult `DATABASE_URL` en `PORT` vaak al in).
4. **Start command** (of `npm start` in `package.json` — dat staat al zo ingesteld):
   - `npm start` voert **`prisma migrate deploy`** uit en start daarna de server. Zo komen migraties op de productiedatabase terecht.
5. Zorg dat de **root directory** van de build je `package.json` is (standaard).

**Binding:** de server luistert op **`0.0.0.0`** en gebruikt **`process.env.PORT`**, zoals Railway verwacht.

## Projectstructuur

- `src/server.js` — start Express, leest poort uit `PORT`
- `src/app.js` — middleware en routes
- `src/routes/authRoutes.js` — register / login
- `src/routes/radioRoutes.js` — tracks, now-playing, playlist
- `src/middleware/requireAuth.js` — controleert JWT
- `prisma/schema.prisma` — database-model
- `.env.example` — welke variabelen je nodig hebt

## Handige commando’s

| Commando | Wat het doet |
|----------|----------------|
| `npm run dev` | Ontwikkeling met automatisch herstart (`node --watch`) |
| `npm start` | Productie: migraties + server |
| `npm run db:migrate` | Lokaal schema bijwerken (`prisma migrate dev`) |
| `npm run db:deploy` | Alleen migraties op een bestaande DB (`prisma migrate deploy`) |
| `npm run db:studio` | Grafisch data bekijken (Prisma Studio) |
