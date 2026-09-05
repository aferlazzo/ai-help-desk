const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TesterRegistry } = require('./tester-registry');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'help-desk-testers-'));
const store = path.join(dir, 'testers.json');
const r = new TesterRegistry(store);

const created = r.registerApproved({ name: 'Example Tester', email: 'TEST@example.com' });
assert.equal(created.tester.status, 'Approved');
assert.ok(created.accessToken.length > 20);
assert.equal(r.verifyAccess('test@example.com', created.accessToken), true);
assert.equal(r.verifyAccess('test@example.com', 'wrong'), false);
assert.equal(r.setStatus('test@example.com', 'Active').status, 'Active');
assert.equal(r.list().length, 1);
assert.equal(Object.prototype.hasOwnProperty.call(r.list()[0], 'tokenHash'), false);
r.setStatus('test@example.com', 'Disabled');
assert.equal(r.verifyAccess('test@example.com', created.accessToken), false);
console.log('tester-registry tests passed');
