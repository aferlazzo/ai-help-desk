const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VALID_STATUSES = new Set(['Requested', 'Approved', 'Setup', 'Active', 'Disabled']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function defaultStorePath() {
  return process.env.HELP_DESK_TESTER_STORE || path.join(process.cwd(), 'data', 'testers.json');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

class TesterRegistry {
  constructor(storePath = defaultStorePath()) {
    this.storePath = storePath;
  }

  _load() {
    if (!fs.existsSync(this.storePath)) return { version: 1, testers: [] };
    const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.testers)) throw new Error('Invalid tester registry file.');
    return parsed;
  }

  _save(data) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.storePath);
  }

  list() {
    return this._load().testers.map(({ tokenHash, ...safe }) => safe);
  }

  findByEmail(email) {
    const normalized = normalizeEmail(email);
    const found = this._load().testers.find(t => t.email === normalized);
    if (!found) return null;
    const { tokenHash, ...safe } = found;
    return safe;
  }

  registerApproved({ name, email }) {
    name = String(name || '').trim();
    email = normalizeEmail(email);
    if (!name) throw new Error('Tester name is required.');
    if (!validateEmail(email)) throw new Error('A valid tester email is required.');

    const data = this._load();
    const now = new Date().toISOString();
    let tester = data.testers.find(t => t.email === email);
    const accessToken = crypto.randomBytes(24).toString('base64url');

    if (!tester) {
      tester = {
        id: crypto.randomUUID(),
        name,
        email,
        status: 'Approved',
        tokenHash: hashToken(accessToken),
        createdAt: now,
        updatedAt: now,
        activatedAt: null,
        disabledAt: null
      };
      data.testers.push(tester);
    } else {
      tester.name = name;
      tester.status = 'Approved';
      tester.tokenHash = hashToken(accessToken);
      tester.updatedAt = now;
      tester.disabledAt = null;
    }

    this._save(data);
    const { tokenHash, ...safe } = tester;
    return { tester: safe, accessToken };
  }

  setStatus(email, status) {
    if (!VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);
    const data = this._load();
    const normalized = normalizeEmail(email);
    const tester = data.testers.find(t => t.email === normalized);
    if (!tester) throw new Error(`Tester not found: ${normalized}`);

    const now = new Date().toISOString();
    tester.status = status;
    tester.updatedAt = now;
    if (status === 'Active') tester.activatedAt = tester.activatedAt || now;
    if (status === 'Disabled') tester.disabledAt = now;
    if (status !== 'Disabled') tester.disabledAt = null;
    this._save(data);

    const { tokenHash, ...safe } = tester;
    return safe;
  }

  verifyAccess(email, token) {
    const normalized = normalizeEmail(email);
    const data = this._load();
    const tester = data.testers.find(t => t.email === normalized);
    if (!tester || !tester.tokenHash || tester.status === 'Disabled') return false;
    const supplied = Buffer.from(hashToken(token), 'hex');
    const expected = Buffer.from(tester.tokenHash, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }
}

module.exports = { TesterRegistry, VALID_STATUSES, normalizeEmail };
