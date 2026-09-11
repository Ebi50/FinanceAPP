/**
 * Browser-Smoke-Test gegen eine laufende (oder selbst gestartete) Dev-Instanz.
 *
 *   npm run smoke
 *
 * Loggt sich mit einem dedizierten Test-Account (smoke-test@finanzapp.local)
 * ein, damit nie die echten Haushalts-Zugangsdaten angefasst werden, und
 * prüft per echtem Chromium ein paar Kernabläufe (aktuell: Login,
 * Profilbild-Upload). Läuft bereits ein Dev-Server auf SMOKE_BASE_URL
 * (Default http://localhost:9002), wird der benutzt; sonst startet das
 * Skript selbst "next dev" und beendet ihn danach wieder.
 *
 * Braucht DATABASE_URL (.env, ggf. Railway-Tunnel starten) und einmalig
 * installierte Chromium-Binaries: npx playwright install chromium.
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const scrypt = promisify(scryptCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCREENSHOT_DIR = path.join(__dirname, 'smoke-screenshots');

const PORT = process.env.SMOKE_PORT || '9002';
const BASE_URL = process.env.SMOKE_BASE_URL || `http://localhost:${PORT}`;
const TEST_EMAIL = 'smoke-test@finanzapp.local';
const TEST_PASSWORD = 'smoke-test-password-not-real';
const TEST_AVATAR = path.join(ROOT, 'docs', 'kategorie_icons_3d_glossy', '02_einnahmen.png');

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function ensureTestUser() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ist nicht gesetzt (.env prüfen, ggf. Railway-Tunnel starten).');
    process.exit(1);
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=(require|verify-ca|verify-full|no-verify)/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
  });
  await client.connect();
  try {
    const hash = await hashPassword(TEST_PASSWORD);
    const { rows } = await client.query(
      'SELECT id FROM profiles WHERE lower(email) = lower($1)',
      [TEST_EMAIL]
    );
    if (rows.length === 0) {
      await client.query(
        `INSERT INTO profiles (email, password_hash, first_name, last_name) VALUES ($1, $2, 'Smoke', 'Test')`,
        [TEST_EMAIL, hash]
      );
      console.log(`Test-Account angelegt: ${TEST_EMAIL}`);
    } else {
      await client.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
    }
  } finally {
    await client.end();
  }
}

async function isServerUp(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerUp(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await ensureTestUser();

  let devServer = null;
  const alreadyRunning = await isServerUp(BASE_URL);
  if (!alreadyRunning) {
    console.log(`Kein Server auf ${BASE_URL} erreichbar — starte "next dev -p ${PORT}" ...`);
    const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    devServer = spawn(process.execPath, [nextBin, 'dev', '-p', PORT], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    const ready = await waitForServer(BASE_URL, 60_000);
    if (!ready) {
      console.error('Dev-Server ist nicht rechtzeitig hochgefahren.');
      stopDevServer(devServer);
      process.exit(1);
    }
  }

  const consoleErrors = [];
  const browser = await chromium.launch();
  let failed = false;
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    console.log('→ Login...');
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button:has-text("Anmelden")');
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png') });
    console.log('  ok — Dashboard geladen.');

    console.log('→ Profilbild-Upload...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_AVATAR);
    await page.waitForSelector('text=Profilbild aktualisiert', { timeout: 15_000 });
    const avatarImg = page.locator('img[alt="Benutzeravatar"]');
    await avatarImg.waitFor({ state: 'visible', timeout: 5_000 });
    const src = await avatarImg.getAttribute('src');
    if (!src || !src.includes('/api/avatar/')) {
      throw new Error(`Avatar-<img> zeigt nicht auf /api/avatar/...: ${src}`);
    }
    const loaded = await avatarImg.evaluate((el) => el.complete && el.naturalWidth > 0);
    if (!loaded) {
      throw new Error('Avatar-<img> verweist auf ' + src + ', ist aber nicht geladen (broken image).');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-avatar.png') });
    console.log('  ok — Profilbild wird angezeigt.');
  } catch (err) {
    console.error('✗ Smoke-Test fehlgeschlagen:', err.message);
    failed = true;
  } finally {
    await browser.close();
    stopDevServer(devServer);
  }

  if (consoleErrors.length > 0) {
    console.error('\nBrowser-Konsole meldete Fehler:');
    for (const e of consoleErrors) console.error('  ' + e);
    failed = true;
  }

  if (failed) {
    console.error('\nSmoke-Test fehlgeschlagen. Screenshots liegen in scripts/smoke-screenshots/.');
    process.exit(1);
  }
  console.log('\nAlle Smoke-Tests erfolgreich.');
}

function stopDevServer(devServer) {
  if (!devServer) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${devServer.pid} /t /f`, { stdio: 'ignore' });
    } catch {
      // Prozess war schon beendet.
    }
  } else {
    devServer.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
