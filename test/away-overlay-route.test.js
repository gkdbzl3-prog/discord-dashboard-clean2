const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');

let registerAwayOverlayRoute;
try {
  ({ registerAwayOverlayRoute } = require('../routes/away-overlay'));
} catch (_) {}

test('GET /away serves the OBS away overlay', () => {
  assert.equal(typeof registerAwayOverlayRoute, 'function');

  let awayHandler;
  registerAwayOverlayRoute({
    get(route, handler) {
      if (route === '/away') awayHandler = handler;
    },
  });
  assert.equal(typeof awayHandler, 'function');

  let body = '';
  awayHandler({}, {
    sendFile(filePath) {
      body = fs.readFileSync(filePath, 'utf8');
    },
  });

  assert.match(body, /id="overlay"/);
});
