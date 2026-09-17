const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const adminKeyInput = document.getElementById('adminKey');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const refreshBotsBtn = document.getElementById('refreshBotsBtn');
const serverSelect = document.getElementById('serverSelect');
const channelSelect = document.getElementById('channelSelect');
const joinAllBtn = document.getElementById('joinAllBtn');
const stopAllBtn = document.getElementById('stopAllBtn');
const leaveAllBtn = document.getElementById('leaveAllBtn');
const botList = document.getElementById('botList');
const logOutput = document.getElementById('logOutput');
const audioLibrary = document.getElementById('audioLibrary');
const audioFileInput = document.getElementById('audioFileInput');
const uploadAudioBtn = document.getElementById('uploadAudioBtn');
const clearLibraryBtn = document.getElementById('clearLibraryBtn');
const timerCheckbox = document.getElementById('loopMode');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const logoutBtn = document.getElementById('logoutBtn');

const state = {
  key: '',
  bots: [],
  logs: [],
  audio: [],
  guilds: [],
  timer: null,
};

function setAuthKey(value) {
  state.key = value.trim();
  sessionStorage.setItem('web_admin_key', state.key);
}

function getAuthKey() {
  const saved = sessionStorage.getItem('web_admin_key') || '';
  if (saved) adminKeyInput.value = saved;
  return saved;
}

function setLoggedIn(loggedIn) {
  loginScreen.classList.toggle('active', !loggedIn);
  dashboardScreen.classList.toggle('active', loggedIn);
  if (!loggedIn) {
    serverSelect.innerHTML = '<option>Choose a server</option>';
    channelSelect.innerHTML = '<option>Choose a channel</option>';
  }
}

async function requestJson(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.key) headers['x-admin-key'] = state.key;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

function scheduleRefresh() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.key) refreshDashboard();
  }, 5000);
}

function renderBots(bots) {
  state.bots = bots || [];
  if (!state.bots.length) {
    botList.innerHTML = '<div class="bot-item"><div class="bot-name">No bots connected.</div></div>';
    return;
  }

  botList.innerHTML = state.bots.map((bot) => {
    const status = bot.status || 'offline';
    const name = bot.tag || `Bot ${bot.number}`;
    return `
      <div class="bot-item">
        <div class="bot-main">
          <div class="bot-name">Bot ${bot.number}</div>
          <div class="bot-tag">${name}</div>
        </div>
        <div class="status-pill">
          <span class="dot ${status === 'online' ? 'online' : status === 'error' ? 'error' : 'offline'}"></span>
          ${status}
        </div>
      </div>
    `;
  }).join('');
}

function renderLogs(logs) {
  state.logs = logs || [];
  logOutput.textContent = state.logs.length
    ? state.logs.map((entry) => `[${new Date(entry.time).toLocaleTimeString()}] ${entry.message}`).join('\n')
    : 'No events yet.';
}

function renderAudioLibrary(items) {
  state.audio = items || [];
  if (!state.audio.length) {
    audioLibrary.innerHTML = '<div class="audio-item"><span>No audio files uploaded yet.</span></div>';
    return;
  }

  audioLibrary.innerHTML = state.audio.map((item) => `
    <div class="audio-item">
      <span>${item.name}</span>
      <button data-audio-name="${item.name}" class="play-audio-btn">Play</button>
    </div>
  `).join('');

  document.querySelectorAll('.play-audio-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const serverId = serverSelect.value;
      const channelId = channelSelect.value;
      if (!serverId || !channelId || !button.dataset.audioName) {
        alert('Choose a server, channel, and audio file first.');
        return;
      }

      try {
        await requestJson('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'play', guildId: serverId, channelId: channelId, filename: button.dataset.audioName }),
        });
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function renderGuilds(guilds) {
  state.guilds = guilds || [];
  const currentServer = serverSelect.value;
  serverSelect.innerHTML = '<option value="">Choose a server</option>' + state.guilds.map((guild) => `
    <option value="${guild.id}" ${guild.id === currentServer ? 'selected' : ''}>${guild.name}</option>
  `).join('');

  const selectedGuild = state.guilds.find((guild) => guild.id === currentServer) || state.guilds[0];
  const channels = selectedGuild ? selectedGuild.channels || [] : [];
  const currentChannel = channelSelect.value;
  channelSelect.innerHTML = '<option value="">Choose a channel</option>' + channels.map((channel) => `
    <option value="${channel.id}" ${channel.id === currentChannel ? 'selected' : ''}>${channel.name}</option>
  `).join('');
}

async function refreshDashboard() {
  try {
    const [bots, logs, audio, guilds] = await Promise.all([
      requestJson('/api/bots'),
      requestJson('/api/logs'),
      requestJson('/api/audio'),
      requestJson('/api/discord-context'),
    ]);
    renderBots(bots);
    renderLogs(logs);
    renderAudioLibrary(audio);
    renderGuilds(guilds.guilds || []);
  } catch (error) {
    console.error(error);
  }
}

async function login() {
  const key = adminKeyInput.value.trim();
  if (!key) {
    alert('Enter the dashboard key first.');
    return;
  }

  setAuthKey(key);
  try {
    await requestJson('/api/bots');
    setLoggedIn(true);
    scheduleRefresh();
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
    setLoggedIn(false);
    setAuthKey('');
    adminKeyInput.value = '';
  }
}

async function submitControl(action) {
  if (!state.key) return;
  const payload = { action };
  if (action === 'join' || action === 'play') {
    payload.guildId = serverSelect.value;
    payload.channelId = channelSelect.value;
  }
  if (action === 'play') {
    const selectedAudio = document.querySelector('.play-audio-btn.active')?.dataset.audioName || audioFileInput.files[0]?.name;
    payload.filename = selectedAudio;
  }

  try {
    await requestJson('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
  }
}

async function uploadAudio() {
  if (!state.key) return;
  const file = audioFileInput.files[0];
  if (!file) {
    alert('Choose an audio file first.');
    return;
  }

  const formData = new FormData();
  formData.append('audio', file);
  try {
    await requestJson('/api/audio/upload', {
      method: 'POST',
      body: formData,
    });
    audioFileInput.value = '';
    await refreshDashboard();
  } catch (error) {
    alert(error.message);
  }
}

openDashboardBtn.addEventListener('click', login);
refreshBotsBtn.addEventListener('click', refreshDashboard);
logoutBtn.addEventListener('click', () => {
  setAuthKey('');
  adminKeyInput.value = '';
  setLoggedIn(false);
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
});
joinAllBtn.addEventListener('click', () => submitControl('join'));
stopAllBtn.addEventListener('click', () => submitControl('stop'));
leaveAllBtn.addEventListener('click', () => submitControl('disconnect'));
uploadAudioBtn.addEventListener('click', uploadAudio);
clearLibraryBtn.addEventListener('click', () => {
  audioLibrary.innerHTML = '<div class="audio-item"><span>Library cleared locally.</span></div>';
});
volumeSlider.addEventListener('input', () => {
  volumeValue.textContent = `${volumeSlider.value}%`;
});

serverSelect.addEventListener('change', () => {
  const selectedGuild = state.guilds.find((guild) => guild.id === serverSelect.value) || state.guilds[0];
  const channels = selectedGuild ? selectedGuild.channels || [] : [];
  channelSelect.innerHTML = '<option value="">Choose a channel</option>' + channels.map((channel) => `
    <option value="${channel.id}">${channel.name}</option>
  `).join('');
});

const savedKey = getAuthKey();
if (savedKey) {
  setLoggedIn(false);
  adminKeyInput.value = savedKey;
}
