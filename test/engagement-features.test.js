const assert = require('node:assert/strict');
const test = require('node:test');

const engagementFeatures = require('../config/engagement-features');

test('legacy engagement features stay disabled', () => {
  assert.deepEqual(engagementFeatures, {
    quietCheer: false,
    randomCheerCommand: false,
    reviewDm: false,
    periodNotices: false,
  });
});
