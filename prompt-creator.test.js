const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMode, systemPrompt, makeSession } = require('./prompt-creator');

test('defaults to Just Do It mode', () => {
  assert.equal(normalizeMode('anything-else'), 'just-do-it');
});

test('preserves Show Me How mode', () => {
  assert.equal(normalizeMode('show-me-how'), 'show-me-how');
});

test('Show Me How requires one useful question at a time', () => {
  const prompt = systemPrompt('show-me-how');
  assert.match(prompt, /one useful question at a time/i);
  assert.match(prompt, /Never ask for facts the AI could reasonably research/i);
  assert.match(prompt, /Stop asking as soon as enough is known/i);
});

test('Just Do It minimizes interruptions and states assumptions', () => {
  const prompt = systemPrompt('just-do-it');
  assert.match(prompt, /without interrupting the user/i);
  assert.match(prompt, /Infer harmless details/i);
  assert.match(prompt, /record them as assumptions/i);
  assert.match(prompt, /Prefer producing the finished prompt immediately/i);
});

test('both modes distinguish user knowledge from researchable facts', () => {
  for (const mode of ['just-do-it', 'show-me-how']) {
    const prompt = systemPrompt(mode);
    assert.match(prompt, /research/i);
    assert.match(prompt, /Do not invent precise facts/i);
  }
});

test('session records mode and original request', () => {
  const session = makeSession('show-me-how', 'Compare a Tucson driving loop with public transit');
  assert.equal(session.mode, 'show-me-how');
  assert.equal(session.request, 'Compare a Tucson driving loop with public transit');
  assert.equal(session.turns, 0);
  assert.ok(session.id);
});

test('Tucson-style incomplete request remains intact for funnel discovery', () => {
  const request = 'Tell me the best route for circling Tucson by car compared with public transportation. Show routes, mileage, and computed MPH.';
  const session = makeSession('show-me-how', request);
  assert.equal(session.request, request);
  assert.equal(session.mode, 'show-me-how');
});
