#!/usr/bin/env node

const [name, email] = process.argv.slice(2);
const gateway = String(process.env.HELP_DESK_GATEWAY_URL || '').replace(/\/$/, '');
const adminToken = process.env.HELP_DESK_ADMIN_TOKEN;

if (!name || !email) {
  console.error('Usage: node scripts/register-tester.js "Tester Name" tester@example.com');
  process.exit(2);
}
if (!gateway || !adminToken) {
  console.error('Set HELP_DESK_GATEWAY_URL and HELP_DESK_ADMIN_TOKEN first.');
  process.exit(2);
}

const response = await fetch(`${gateway}/admin/testers`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({ name, email })
});

const text = await response.text();
let body;
try { body = JSON.parse(text); } catch { body = { raw: text }; }

if (!response.ok) {
  console.error(`Registration failed (${response.status}).`);
  console.error(body.error || body.raw || 'Unknown error');
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
