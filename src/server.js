require('dotenv').config({ quiet: true });

const express = require('express');
const QRCode = require('qrcode');
const { auth: oidcAuth, requiresAuth } = require('express-openid-connect');
const { auth: jwtAuth, requiredScopes } = require('express-oauth2-jwt-bearer');

const db = require('./db');
const views = require('./views');

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`)
  .replace(/\/+$/, '');

const required = ['DATABASE_URL', 'AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'SESSION_SECRET', 'API_AUDIENCE'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Nedostaju varijable okruženja: ${missing.join(', ')}`);
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => UUID_RE.test(s);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toJson(p) {
  return {
    id: p.id,
    name: p.name,
    document: p.document,
    issuedAt: new Date(p.issued_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: p.status,
  };
}

const app = express();
app.set('trust proxy', 1);

const jwtCheck = jwtAuth({
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  audience: process.env.API_AUDIENCE,
  tokenSigningAlg: 'RS256',
});

const checkJwt = (req, res, next) => jwtCheck(req, res, (err) => {
  if (err && (err.status || err.statusCode) === 400) {
    err.status = err.statusCode = 401;
    err.code = 'invalid_token';
    err.message = err.message || 'Pristupni token nedostaje ili nije valjan.';
    err.headers = { 'WWW-Authenticate': 'Bearer realm="api", error="invalid_token"' };
  }
  next(err);
});

const api = express.Router();

api.get('/passes/:id', checkJwt, requiredScopes('read:passes'), wrap(async (req, res) => {
  const pass = isUuid(req.params.id) ? await db.get(req.params.id) : null;
  if (!pass) return res.status(404).json({ error: 'not_found', message: 'Propusnica ne postoji.' });
  res.json(toJson(pass));
}));

api.post('/passes', checkJwt, requiredScopes('create:passes'), express.json(), wrap(async (req, res) => {
  const { name, document } = req.body || {};
  const valid = (v) => typeof v === 'string' && v.trim() !== '';
  if (!valid(name) || !valid(document)) {
    return res.status(400).json({ error: 'bad_request', message: 'Polja name i document su obavezna i ne smiju biti prazna.' });
  }

  const pass = await db.create(name.trim(), document.trim());

  const png = await QRCode.toBuffer(`${BASE_URL}/info/${pass.id}`, { type: 'png', width: 320, margin: 2 });

  res.status(201)
    .location(`${BASE_URL}/passes/${pass.id}`)
    .type('image/png')
    .send(png);
}));

api.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (err.headers) res.set(err.headers);
  const code = err.code || (err.type === 'entity.parse.failed' ? 'bad_request' : status === 401 ? 'unauthorized' : 'error');
  res.status(status).json({ error: code, message: status >= 500 ? 'Interna greška.' : err.message });
});

app.use(api);

app.use(oidcAuth({
  authRequired: false,
  auth0Logout: true,
  baseURL: BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  secret: process.env.SESSION_SECRET,
}));

app.get('/', wrap(async (req, res) => {
  const user = req.oidc.isAuthenticated() ? req.oidc.user : null;
  const counts = await db.counts();
  const passes = user ? await db.list() : [];
  res.send(views.home({ user, counts, passes }));
}));


app.get('/info/:id', wrap(async (req, res) => {
  const pass = isUuid(req.params.id) ? await db.get(req.params.id) : null;
  if (!pass) return res.status(404).send(views.error(404, 'Propusnica s tim identifikatorom ne postoji.'));
  res.send(views.info(pass));
}));

app.post('/admin/passes/:id/cancel', requiresAuth(), wrap(async (req, res) => {
  if (isUuid(req.params.id)) await db.cancel(req.params.id);
  res.redirect('/');
}));

app.post('/admin/passes/:id/delete', requiresAuth(), wrap(async (req, res) => {
  if (isUuid(req.params.id)) await db.remove(req.params.id);
  res.redirect('/');
}));

app.use((req, res) => res.status(404).send(views.error(404, 'Stranica ne postoji.')));

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).send(views.error(status, status >= 500 ? 'Interna greška.' : err.message));
});

db.init()
  .then(() => app.listen(PORT, () => console.log(`Aplikacija radi na ${BASE_URL} (port ${PORT})`)))
  .catch((err) => {
    console.error('Neuspjelo spajanje na bazu:', err);
    process.exit(1);
  });
