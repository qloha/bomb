(function(){
  const $ = (id) => document.getElementById(id);
  const joinDiv = $('join');
  const chatDiv = $('chat');
  const usernameInput = $('username');
  const roomInput = $('room');
  const joinBtn = $('joinBtn');
  const messages = $('messages');
  const msgForm = $('msgForm');
  const msgInput = $('msgInput');
  const roomName = $('roomName');
  const usersDiv = $('users');
  const usersList = $('usersList');

  // debug panel
  let debugPanel;
  function ensureDebug(){
    if (debugPanel) return debugPanel;
    debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.left = '18px';
    debugPanel.style.bottom = '18px';
    debugPanel.style.padding = '8px 10px';
    debugPanel.style.background = 'rgba(0,0,0,0.5)';
    debugPanel.style.color = '#dfe9ff';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.borderRadius = '8px';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.maxWidth = '320px';
    debugPanel.style.maxHeight = '160px';
    debugPanel.style.overflow = 'auto';
    debugPanel.innerText = 'debug:';
    document.body.appendChild(debugPanel);
    return debugPanel;
  }

  let ws;
  let me = null;

  function dbgAddLine(text){
    try{
      const p = document.createElement('div');
      p.textContent = text;
      p.style.marginBottom = '4px';
      const dp = ensureDebug();
      dp.appendChild(p);
      while(dp.children.length > 8) dp.removeChild(dp.firstChild);
    }catch(e){/* ignore */}
  }

  function formatTime(ts){
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  function addMessage(msg){
    console.debug('addMessage called', msg);
    const d = document.createElement('div');
    d.className = 'msg';
    if (msg.type === 'system') d.classList.add('system');
    if (me && msg.username === me.username) d.classList.add('me');

    const author = document.createElement('div');
    author.className = 'author';
    author.textContent = msg.username || 'system';

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = msg.text || '';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.style.fontSize = '12px';
    meta.style.marginTop = '6px';
    meta.style.opacity = '0.7';
    meta.textContent = msg.ts ? formatTime(msg.ts) : '';

    if (msg.type !== 'system') d.appendChild(author);
    d.appendChild(text);
    d.appendChild(meta);

    // append
    messages.appendChild(d);

    // Ensure the element becomes visible even if CSS animation isn't applied
    requestAnimationFrame(() => {
      try { d.scrollIntoView({ block: 'end', behavior: 'auto' }); } catch(e){ messages.scrollTop = messages.scrollHeight; }
      d.style.opacity = '1';
      d.style.transform = 'none';
    });

    // extra fallback in case RAF isn't enough due to CSS/layout timing
    setTimeout(() => {
      try { d.scrollIntoView({ block: 'end', behavior: 'auto' }); } catch(e) { messages.scrollTop = messages.scrollHeight; }
      d.style.opacity = '1';
      d.style.transform = 'none';
    }, 50);
  }

  function renderHistory(h){
    // render older messages first (chronological)
    (h || []).forEach(m => {
      const msg = m;
      // ensure message entries have type (for system vs message)
      if (!msg.type) msg.type = 'message';
      addMessage(msg);
    });
    // scroll to bottom once after history render
    setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 0);
  }

  function setPresence(users){
    usersDiv.textContent = `${users.length} online`;
    usersList.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      const dot = document.createElement('div');
      dot.className = 'dot';
      const name = document.createElement('div');
      // include IP if provided (remoteAddress)
      name.textContent = u.remoteAddress ? `${u.username} (${u.remoteAddress})` : u.username;
      li.appendChild(dot);
      li.appendChild(name);
      usersList.appendChild(li);
    });
  }

  function connect(username, room){
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?room=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`;
    ws = new WebSocket(url);
    // expose for debugging
    try{ window._bombWs = ws; } catch(e){}
    dbgAddLine('connecting...');

    ws.addEventListener('open', () => {
      dbgAddLine('open');
      console.log('ws open');
    });

    ws.addEventListener('message', (ev) => {
      dbgAddLine('RAW: ' + String(ev.data).slice(0, 200));
      console.debug('WS RAW:', ev.data);
      let msg;
      try{ msg = JSON.parse(ev.data); } catch(e){ console.warn('invalid json'); dbgAddLine('invalid json'); return; }
      console.debug('WS MSG:', msg);
      dbgAddLine('MSG: ' + (msg.type || '?'));
      if (msg.type === 'joined'){
        me = msg.me;
        roomName.textContent = msg.room;
        joinDiv.style.display = 'none';
        chatDiv.style.display = 'block';
        messages.innerHTML = '';
        renderHistory(msg.history || []);

        // show my ip in debug area and presence header (if available)
        if (me && me.remoteAddress) dbgAddLine('my ip: ' + me.remoteAddress);
      } else if (msg.type === 'message'){
        addMessage(msg);
      } else if (msg.type === 'system'){
        addMessage({ type: 'system', text: msg.text, ts: msg.ts });
      } else if (msg.type === 'presence'){
        setPresence(msg.users || []);
      } else if (msg.type === 'error'){
        addMessage({ type: 'system', text: `Error: ${msg.reason}` });
      } else {
        console.warn('Unknown WS message type:', msg);
      }
    });

    ws.addEventListener('close', () => {
      dbgAddLine('closed');
      addMessage({ type: 'system', text: 'Disconnected', ts: Date.now() });
    });

    ws.addEventListener('error', (e) => {
      dbgAddLine('error');
      console.error('ws error', e);
    });
  }

  joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim() || `anon${Math.floor(Math.random()*1000)}`;
    const room = roomInput.value.trim() || 'lobby';
    connect(username, room);
  });

  msgForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'message', text }));
    msgInput.value = '';
  });

})();