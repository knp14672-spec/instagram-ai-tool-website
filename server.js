// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // put index.html, css, js inside ./public

// In-memory store of active users: { socketId: {name, ig, lat, lon, lastSeen}}
const users = {};

function distanceMeters(lat1, lon1, lat2, lon2) {
  // Haversine formula
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  socket.on('register', (payload) => {
    // payload: { name, ig, lat, lon }
    users[socket.id] = {
      name: payload.name || 'Anonymous',
      ig: payload.ig || '',
      lat: payload.lat,
      lon: payload.lon,
      lastSeen: Date.now()
    };
    // send immediate nearby list
    sendNearby(socket);
  });

  socket.on('updateLocation', (payload) => {
    if (!users[socket.id]) return;
    users[socket.id].lat = payload.lat;
    users[socket.id].lon = payload.lon;
    users[socket.id].lastSeen = Date.now();
    // send updated nearby to this client
    sendNearby(socket);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    delete users[socket.id];
  });
});

function sendNearby(socket) {
  const me = users[socket.id];
  if (!me || me.lat == null || me.lon == null) return;

  const nearby = [];
  for (const [id, u] of Object.entries(users)) {
    if (id === socket.id) continue;
    if (u.lat == null || u.lon == null) continue;
    // optional: ignore stale entries older than 60s
    if (Date.now() - (u.lastSeen || 0) > 60000) continue;

    const d = distanceMeters(me.lat, me.lon, u.lat, u.lon);
    if (d <= 100) {
      nearby.push({
        name: u.name,
        ig: u.ig,
        distanceMeters: Math.round(d)
      });
    }
  }
  socket.emit('nearby', nearby);
}

// Optionally broadcast updates to all (not necessary). Keep it minimal.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
