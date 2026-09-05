#!/usr/bin/env node
const { TesterRegistry } = require('./tester-registry');

function usage() {
  console.log(`Usage:\n  node tester-admin.js register "Name" email@example.com\n  node tester-admin.js status email@example.com Active\n  node tester-admin.js list\n  node tester-admin.js verify email@example.com ACCESS_TOKEN`);
}

try {
  const registry = new TesterRegistry();
  const [, , command, ...args] = process.argv;

  if (command === 'register') {
    const [name, email] = args;
    const result = registry.registerApproved({ name, email });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'status') {
    const [email, status] = args;
    console.log(JSON.stringify(registry.setStatus(email, status), null, 2));
  } else if (command === 'list') {
    console.log(JSON.stringify(registry.list(), null, 2));
  } else if (command === 'verify') {
    const [email, token] = args;
    console.log(JSON.stringify({ authorized: registry.verifyAccess(email, token) }));
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
