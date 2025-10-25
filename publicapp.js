// app.js
const socket = io();

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const nearbyList = document.getElementById('nearbyList');

let watchId = null;
let sharing = false;

function setStatus(s) {
  statusEl.textContent = s;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) *
    Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

startBtn.addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const ig = document.getElementById('ig').value.trim();
  if (!ig) {
    alert('Please enter your Instagram handle (consent-based).');
    return;
  }

  if (!navigator.geolocation) {
    alert('Geolocation not supported in your browser.');
    return;
  }

  // get current position first
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    socket.emit('register', { name, ig, lat, lon });
    setStatus('Sharing location — live');
    sharing = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // start a watch to update location periodically
    watchId = navigator.geolocation.watchPosition(p => {
      const { latitude, longitude } = p.coords;
      socket.emit('updateLocation', { lat: latitude, lon: longitude });
    }, err => {
      console.warn('geo watch err', err);
    }, { maximumAge: 5000, enableHighAccuracy: true, timeout: 10000 });

  }, err => {
    alert('Could not access location: ' + err.message);
  }, { enableHighAccuracy: true, timeout: 10000 });
});

stopBtn.addEventListener('click', () => {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Stopped sharing.');
  sharing = false;
  // disconnect socket to remove server-side entry
  socket.disconnect();
  // reconnect socket for possible future reuse
  setTimeout(() => { location.reload(); }, 400);
});

socket.on('connect', () => {
  console.log('socket connected', socket.id);
});

socket.on('nearby', (list) => {
  // list: [{name, ig, distanceMeters}]
  nearbyList.innerHTML = '';
  if (!list || list.length === 0) {
    nearbyList.innerHTML = '<li style="opacity:0.7">No consenting users within 100 m</li>';
    return;
  }
  list.sort((a,b)=>a.distanceMeters - b.distanceMeters);
  for (const u of list) {
    const li = document.createElement('li');
    li.innerHTML = <div><strong>${escapeHtml(u.name || u.ig)}</strong><div class="small">${escapeHtml(u.ig)}</div></div><div style="text-align:right"><div>${u.distanceMeters} m</div></div>;
    nearbyList.appendChild(li);
  }
});

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);});
}
