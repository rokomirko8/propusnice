// Jednostavni HTML predlošci (bez dodatnog templating enginea).

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d) {
  return new Date(d).toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });
}

const css = `
  :root { --bg:#f6f7f9; --card:#fff; --text:#1d2330; --muted:#667085; --line:#e4e7ec;
          --accent:#2457d6; --ok:#137a3e; --okbg:#e6f4ea; --bad:#b42318; --badbg:#fdecea; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:var(--bg); color:var(--text); line-height:1.5; }
  header { background:var(--card); border-bottom:1px solid var(--line); }
  .wrap { max-width:960px; margin:0 auto; padding:16px; }
  header .wrap { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  h1 { font-size:1.25rem; margin:0; }
  h2 { font-size:1.1rem; margin:24px 0 12px; }
  a { color:var(--accent); }
  .btn { display:inline-block; padding:6px 14px; border-radius:6px; border:1px solid var(--line);
         background:var(--card); color:var(--text); text-decoration:none; font:inherit; cursor:pointer; }
  .btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  .btn.danger { color:var(--bad); border-color:#f3c3be; }
  .btn:disabled { opacity:.4; cursor:default; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-top:16px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .stat .n { font-size:2rem; font-weight:600; }
  .stat .l { color:var(--muted); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  table { width:100%; border-collapse:collapse; background:var(--card); }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:middle; white-space:nowrap; }
  td.id { font-family: ui-monospace, Consolas, monospace; font-size:.8rem; }
  th { color:var(--muted); font-weight:500; font-size:.9rem; }
  .table-scroll { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:.8rem; font-weight:600; }
  .badge.ACTIVE { background:var(--okbg); color:var(--ok); }
  .badge.CANCELLED { background:var(--badbg); color:var(--bad); }
  .actions { display:flex; gap:6px; }
  .actions form { margin:0; }
  dl { display:grid; grid-template-columns:max-content 1fr; gap:6px 16px; margin:0; }
  dt { color:var(--muted); }
  dd { margin:0; word-break:break-all; }
  .muted { color:var(--muted); }
`;

function layout(title, body, headerRight = '') {
  return `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
  <header><div class="wrap"><h1><a href="/" style="color:inherit;text-decoration:none">Digitalne propusnice</a></h1><div>${headerRight}</div></div></header>
  <main class="wrap">${body}</main>
</body>
</html>`;
}

function home({ user, counts, passes }) {
  const headerRight = user
    ? `<span class="muted">${esc(user.email || user.name)}</span> &nbsp; <a class="btn" href="/logout">Odjava</a>`
    : `<a class="btn primary" href="/login">Prijava</a>`;

  const stats = `
    <div class="stats">
      <div class="stat"><div class="n">${counts.total}</div><div class="l">Ukupno propusnica</div></div>
      <div class="stat"><div class="n">${counts.active}</div><div class="l">Aktivnih propusnica</div></div>
    </div>`;

  if (!user) {
    return layout('Digitalne propusnice', `${stats}
      <p class="muted" style="margin-top:24px">Za pregled i upravljanje propusnicama potrebno se <a href="/login">prijaviti</a>.</p>`, headerRight);
  }

  const rows = passes.map((p) => `
    <tr>
      <td class="id"><a href="/info/${esc(p.id)}">${esc(p.id)}</a></td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.document)}</td>
      <td>${esc(fmtDate(p.issued_at))}</td>
      <td><span class="badge ${esc(p.status)}">${esc(p.status)}</span></td>
      <td><div class="actions">
        <form method="post" action="/admin/passes/${esc(p.id)}/cancel">
          <button class="btn" ${p.status === 'CANCELLED' ? 'disabled' : ''}>Poništi</button>
        </form>
        <form method="post" action="/admin/passes/${esc(p.id)}/delete" onsubmit="return confirm('Obrisati propusnicu?')">
          <button class="btn danger">Obriši</button>
        </form>
      </div></td>
    </tr>`).join('');

  const table = passes.length
    ? `<div class="table-scroll"><table>
        <thead><tr><th>Identifikator</th><th>Ime i prezime</th><th>Dokument</th><th>Izdana</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
    : `<p class="muted">U bazi trenutno nema propusnica.</p>`;

  return layout('Digitalne propusnice', `${stats}<h2>Propusnice</h2>${table}`, headerRight);
}

function info(p) {
  return layout('Propusnica', `
    <h2>Propusnica</h2>
    <div class="card">
      <dl>
        <dt>Status</dt><dd><span class="badge ${esc(p.status)}">${esc(p.status)}</span></dd>
        <dt>Ime i prezime</dt><dd>${esc(p.name)}</dd>
        <dt>Dokument</dt><dd>${esc(p.document)}</dd>
        <dt>Vrijeme izdavanja</dt><dd>${esc(fmtDate(p.issued_at))}</dd>
        <dt>Identifikator</dt><dd>${esc(p.id)}</dd>
      </dl>
    </div>`);
}

function error(status, message) {
  return layout(`Greška ${status}`, `<h2>Greška ${esc(status)}</h2><p>${esc(message)}</p><p><a href="/">Početna stranica</a></p>`);
}

module.exports = { home, info, error };
