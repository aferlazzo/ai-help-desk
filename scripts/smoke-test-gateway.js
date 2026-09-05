#!/usr/bin/env node

const gateway = String(process.env.HELP_DESK_GATEWAY_URL || '').replace(/\/$/, '');
if (!gateway) {
  console.error('Set HELP_DESK_GATEWAY_URL first.');
  process.exit(2);
}

async function check(path, expectedStatus) {
  const response = await fetch(`${gateway}${path}`, { redirect: 'manual' });
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: expected ${expectedStatus}, got ${response.status}`);
  }
  console.log(`PASS ${path} -> ${response.status}`);
}

try {
  await check('/health', 200);
  await check('/', 401);
  console.log('Gateway smoke test passed.');
} catch (error) {
  console.error(`Gateway smoke test failed: ${error.message}`);
  process.exit(1);
}
