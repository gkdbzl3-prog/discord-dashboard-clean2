const path = require('path');

function sendAwayOverlay(_req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'away_overlay.html'));
}

function registerAwayOverlayRoute(app) {
  app.get('/away', sendAwayOverlay);
}

module.exports = { registerAwayOverlayRoute, sendAwayOverlay };
