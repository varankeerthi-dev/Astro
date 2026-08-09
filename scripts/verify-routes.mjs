// verify-routes.mjs — boot dev server, sweep routes, report, shutdown.
// Run: node scripts/verify-routes.mjs  (assumes .env has DATABASE_URL)
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const log = (m) => console.log(m);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function up() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(BASE + '/', { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch (_) {}
    await wait(2000);
  }
  return false;
}

async function hit(path, cookie) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, {
      redirect: 'manual',
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(25000),
    });
    return { code: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { code: 0, ms: Date.now() - t0, err: e.name === 'TimeoutError' ? 'TIMEOUT' : e.message };
  }
}

const PUBLIC = [
  '/', '/robots.txt', '/sitemap.xml', '/search?q=quotation',
  '/help', '/help/create-quotation', '/help/release-notes',
  '/blog', '/blog/neon-migration-guide', '/locations/erp-software-chennai',
  '/admin/login', '/admin',
];

const ADMIN = [
  '/admin', '/admin/settings', '/admin/banners', '/admin/announcements',
  '/admin/blog', '/admin/help', '/admin/locations', '/admin/media',
  '/admin/seo', '/admin/users', '/admin/audit', '/admin/releases',
];

const main = async () => {
  // stop any existing dev server first
  try { execSync('npx astro dev stop', { stdio: 'ignore', shell: true }); } catch (_) {}
  await wait(2000);

  const child = spawn('npm', ['run', 'dev'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let devLog = '';
  child.stdout.on('data', (d) => { devLog += d; });
  child.stderr.on('data', (d) => { devLog += d; });

  const ready = await up();
  if (!ready) {
    log('FAIL: dev server never became ready');
    log(devLog.slice(-2000));
    child.kill();
    process.exit(1);
  }
  log('dev server ready');

  // login to get the admin cookie
  const login = await fetch(BASE + '/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'email=admin@perfecterp.com&password=ChangeMe123!',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  const setCookie = login.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  log(`login: HTTP ${login.status} ${cookie ? '(cookie: ' + cookie.slice(0, 20) + '…)' : '(NO COOKIE)'}`);

  log('\n── public routes ──');
  for (const p of PUBLIC) {
    const r = await hit(p);
    log(`${r.code === 0 ? 'FAIL' : r.code}  ${r.ms}ms  ${p}${r.err ? '  [' + r.err + ']' : ''}`);
    if (r.code === 0) { log('── server died; log tail: ──'); log(devLog.slice(-1500)); break; }
  }

  if (cookie) {
    log('\n── admin routes ──');
    for (const p of ADMIN) {
      const r = await hit(p, cookie);
      log(`${r.code === 0 ? 'FAIL' : r.code}  ${r.ms}ms  ${p}${r.err ? '  [' + r.err + ']' : ''}`);
      if (r.code === 0) { log('── server died; log tail: ──'); log(devLog.slice(-1500)); break; }
    }
  }

  child.kill();
  log('\ndone');
  process.exit(0);
};

main();
