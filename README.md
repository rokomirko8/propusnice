# Digitalne propusnice

Web-aplikacija za izdavanje, provjeru i upravljanje digitalnim propusnicama.
Node.js (Express) + PostgreSQL + Auth0 (OpenID Connect za korisnike, OAuth2 Client Credentials za automat).

## Rute

| Metoda i putanja | Zaštita | Opis |
|---|---|---|
| `GET /` | javno | Broj svih i aktivnih propusnica; prijavljenom korisniku popis s poništavanjem i brisanjem |
| `GET /info/:id` | javno | Status i podaci propusnice (adresa iz QR koda); 404 ako ne postoji |
| `GET /login`, `GET /logout`, `/callback` | — | OIDC prijava/odjava (Auth0) |
| `POST /admin/passes/:id/cancel` | prijava (OIDC) | Poništavanje (status `CANCELLED`) |
| `POST /admin/passes/:id/delete` | prijava (OIDC) | Brisanje |
| `GET /passes/:id` | M2M token, scope `read:passes` | JSON propusnice; 401 / 403 / 404 |
| `POST /passes` | M2M token, scope `create:passes` | Tijelo `{"name","document"}` → 201, `image/png` s QR kodom, `Location: <BASE_URL>/passes/<id>`; 400 za prazna polja |

QR kod sadrži adresu javne stranice `/info/<id>`, a zaglavlje `Location` adresu pristupne točke `/passes/<id>`. QR kod se ne sprema — generira se pri izdavanju.

## Postavljanje

### 1. Auth0

1. **Prijava korisnika** — *Applications → Applications → Create Application → Regular Web Applications*.
   - *Allowed Callback URLs*: `https://<tvoja-app>.onrender.com/callback, http://localhost:3000/callback`
   - *Allowed Logout URLs*: `https://<tvoja-app>.onrender.com, http://localhost:3000`
   - *Advanced Settings → Grant Types*: mora biti uključen **Implicit** (aplikacija koristi `id_token` + `form_post`, pa ne treba client secret web-aplikacije).
   - Zapiši **Domain** (→ `AUTH0_ISSUER_BASE_URL = https://<domain>`) i **Client ID** (→ `AUTH0_CLIENT_ID`).
2. **API** — *Applications → APIs → Create API*: ime po želji, *Identifier* npr. `WEB2-PROPUSNICE` (to je `audience`, → `API_AUDIENCE`), algoritam RS256.
   Na kartici *Permissions* dodaj `read:passes` i `create:passes`.
3. **Automat (M2M)** — *Applications → Create Application → Machine to Machine*, odaberi gornji API i označi oba dopuštenja.
   Njegovi **Client ID** i **Client Secret** idu samo u JSON odgovor, ne u kod ni na Render.
4. **Testni korisnik** — *User Management → Users → Create User* (veza *Username-Password-Authentication*).
   Provjeri da je ta veza uključena za web-aplikaciju (*Applications → tvoja app → Connections*).

### 2. Render

1. *New → Postgres* (Free, regija Frankfurt). Kopiraj **Internal Database URL**.
2. Postavi kod na GitHub/GitLab (repozitorij privatan do isteka roka).
3. *New → Web Service* → odaberi repozitorij. Runtime **Node**, Build `npm install`, Start `npm start`, ista regija kao baza.
4. *Environment Variables*: `DATABASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `SESSION_SECRET`, `API_AUDIENCE`
   (`BASE_URL` nije potreban — Render postavlja `RENDER_EXTERNAL_URL`). Tablica se stvara automatski pri pokretanju.
5. Nakon prvog deploya provjeri da su callback/logout adrese u Auth0 baš adresa servisa.

Besplatni Render servis se uspava nakon neaktivnosti, pa prvi zahtjev može trajati desetak sekundi ili dulje.
Besplatna Render baza ima ograničen rok trajanja — provjeri da ne istekne prije pregleda.

### 3. Lokalno pokretanje

```bash
cp .env.example .env   # popuni vrijednosti
npm install
npm start
```

## Testiranje M2M pristupnih točaka

```bash
# 1) dohvat tokena (client_credentials)
TOKEN=$(curl -s https://<domain>/oauth/token \
  -H 'content-type: application/json' \
  -d '{"client_id":"<M2M_ID>","client_secret":"<M2M_SECRET>","audience":"WEB2-PROPUSNICE","grant_type":"client_credentials"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')

# 2) izdavanje propusnice -> qr.png, Location u zaglavlju
curl -i -X POST https://<app>.onrender.com/passes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Pero Perić","document":"HR-123456789"}' -o qr.png -D -

# 3) dohvat propusnice
curl https://<app>.onrender.com/passes/<id> -H "authorization: Bearer $TOKEN"
```

## Osjetljivi podaci

`.env` je u `.gitignore`. Lozinke, `client_secret`, `SESSION_SECRET` i podaci za bazu postoje samo u lokalnom `.env` i u postavkama Render servisa.
