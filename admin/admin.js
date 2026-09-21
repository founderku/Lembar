/* Lembar — admin panel logic.
   No backend: reads/writes data/karya.json and data/penulis.json directly
   in your GitHub repo via the GitHub Contents API, using a Personal
   Access Token you enter once (kept only in this browser's localStorage). */
(function(){
  "use strict";
  var MI = window.LembarIconsMisc, U = window.LembarUtil;
  var CATS = window.LembarCats, CAT_ORDER = window.LembarCatOrder;
  var CFG = window.LEMBAR_CONFIG || {};

  var LS_TOKEN = 'lembar_admin_token';
  var LS_REPO = 'lembar_admin_repo';
  var SS_UNLOCKED = 'lembar_admin_unlocked';

  var state = {
    unlocked: false,
    tab: 'karya',
    connected: false,
    connecting: false,
    connectError: '',
    karya: [], karyaSha: null,
    penulis: {}, penulisSha: null,
    dataLoaded: false,
    dataError: ''
  };

  /* ---------------- storage helpers ---------------- */
  function getToken(){ try{ return localStorage.getItem(LS_TOKEN) || ''; }catch(e){ return ''; } }
  function setToken(t){ try{ if(t) localStorage.setItem(LS_TOKEN, t); else localStorage.removeItem(LS_TOKEN); }catch(e){} }
  function getRepoConfig(){
    var stored = null;
    try{ stored = JSON.parse(localStorage.getItem(LS_REPO) || 'null'); }catch(e){}
    var def = (CFG.github || {});
    return {
      owner: (stored && stored.owner) || def.owner || '',
      repo: (stored && stored.repo) || def.repo || '',
      branch: (stored && stored.branch) || def.branch || 'main'
    };
  }
  function setRepoConfig(cfg){ try{ localStorage.setItem(LS_REPO, JSON.stringify(cfg)); }catch(e){} }

  /* ---------------- github api ---------------- */
  function b64EncodeUtf8(str){ return btoa(unescape(encodeURIComponent(str))); }
  function b64DecodeUtf8(b64){ return decodeURIComponent(escape(atob(b64.replace(/\n/g,'')))); }

  async function safeErrText(res){
    try{ var j = await res.json(); return j.message || JSON.stringify(j); }catch(e){ return res.statusText; }
  }

  async function ghGetFile(path){
    var rc = getRepoConfig(), token = getToken();
    var url = 'https://api.github.com/repos/'+rc.owner+'/'+rc.repo+'/contents/'+encodeURIComponent(path)+'?ref='+encodeURIComponent(rc.branch);
    var res = await fetch(url, { headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json' } });
    if(res.status===404) return { data:null, sha:null };
    if(!res.ok) throw new Error('Gagal memuat '+path+': '+(await safeErrText(res)));
    var json = await res.json();
    var text = b64DecodeUtf8(json.content);
    return { data: JSON.parse(text), sha: json.sha };
  }

  async function ghPutFile(path, dataObj, sha, message){
    var rc = getRepoConfig(), token = getToken();
    var url = 'https://api.github.com/repos/'+rc.owner+'/'+rc.repo+'/contents/'+encodeURIComponent(path);
    var body = {
      message: message,
      content: b64EncodeUtf8(JSON.stringify(dataObj, null, 2) + '\n'),
      branch: rc.branch
    };
    if(sha) body.sha = sha;
    var res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json', 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Gagal menyimpan '+path+': '+(await safeErrText(res)));
    return res.json();
  }

  async function testConnection(){
    var rc = getRepoConfig(), token = getToken();
    if(!rc.owner || !rc.repo || !token){ return {ok:false, message:'Lengkapi owner, repo, dan token terlebih dahulu.'}; }
    try{
      var res = await fetch('https://api.github.com/repos/'+rc.owner+'/'+rc.repo, {
        headers: { Authorization: 'Bearer '+token, Accept: 'application/vnd.github+json' }
      });
      if(res.status===404) return {ok:false, message:'Repo tidak ditemukan, atau token tidak punya akses ke repo ini.'};
      if(res.status===401) return {ok:false, message:'Token tidak valid atau sudah kedaluwarsa.'};
      if(!res.ok) return {ok:false, message:'Gagal terhubung: '+(await safeErrText(res))};
      var json = await res.json();
      if(json.permissions && json.permissions.push===false){
        return {ok:false, message:'Token terhubung, tapi tidak punya izin menulis (write) ke repo ini.'};
      }
      return {ok:true};
    }catch(e){
      return {ok:false, message:'Gagal terhubung: '+e.message};
    }
  }

  /* ---------------- data load/save ---------------- */
  async function loadAllData(){
    state.dataLoaded = false; state.dataError=''; renderApp();
    try{
      var k = await ghGetFile('data/karya.json');
      var p = await ghGetFile('data/penulis.json');
      state.karya = k.data || []; state.karyaSha = k.sha;
      state.penulis = p.data || {}; state.penulisSha = p.sha;
      state.dataLoaded = true;
    }catch(e){
      state.dataError = e.message;
      state.dataLoaded = true;
    }
    renderApp();
  }

  async function saveKarya(newList, message){
    var fresh = await ghGetFile('data/karya.json'); // avoid clobbering concurrent edits
    var res = await ghPutFile('data/karya.json', newList, fresh.sha, message);
    state.karya = newList;
    state.karyaSha = res.content && res.content.sha;
  }
  async function savePenulis(newMap, message){
    var fresh = await ghGetFile('data/penulis.json');
    var res = await ghPutFile('data/penulis.json', newMap, fresh.sha, message);
    state.penulis = newMap;
    state.penulisSha = res.content && res.content.sha;
  }

  function ensurePenulisStub(nama){
    var slug = U.slugify(nama);
    if(!state.penulis[slug]){
      var copy = Object.assign({}, state.penulis);
      copy[slug] = { nama: nama, role:'', bio:'', email:'', instagram:'', linkedin:'' };
      return copy;
    }
    return null;
  }

  /* ---------------- password gate ---------------- */
  async function sha256Hex(str){
    var enc = new TextEncoder().encode(str);
    var buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  function renderGate(){
    var root = document.getElementById('admin-root');
    if(!CFG.adminPasswordHash){
      root.innerHTML = '<div class="wrap"><div class="gatecard form-card">'+
        '<h1 class="font-display" style="font-size:22px; margin-bottom:10px;">Admin belum diatur</h1>'+
        '<p style="color:var(--ink-soft); font-size:14px; line-height:1.6; margin-bottom:18px;">Kamu belum membuat password admin. Buka <code>generate-password-hash.html</code>, buat hash dari password pilihanmu, lalu tempel ke <code>adminPasswordHash</code> di <code>config.js</code>.</p>'+
        '<a href="generate-password-hash.html" class="btn btn-primary btn-sm">Buat Password Admin</a>'+
      '</div></div>';
      return;
    }
    root.innerHTML = '<div class="wrap"><div class="gatecard form-card">'+
      '<div class="icon-btn" style="width:48px;height:48px;margin:0 auto 16px;">'+MI.lock+'</div>'+
      '<h1 class="font-display" style="font-size:22px; margin-bottom:6px;">Masuk sebagai Admin</h1>'+
      '<p style="color:var(--ink-soft); font-size:14px; margin-bottom:20px;">Halaman ini hanya untuk pengelola situs Lembar.</p>'+
      '<div class="field" style="text-align:left;"><input class="input" id="gate-pw" type="password" placeholder="Password admin" autocomplete="current-password"></div>'+
      '<div id="gate-err" style="color:var(--danger); font-size:13px; margin-bottom:10px; display:none;">Password salah.</div>'+
      '<button class="btn btn-primary" id="gate-btn" style="width:100%;">Masuk</button>'+
    '</div></div>';
    var pw = document.getElementById('gate-pw');
    var err = document.getElementById('gate-err');
    async function tryUnlock(){
      var h = await sha256Hex(pw.value||'');
      if(h===CFG.adminPasswordHash){
        try{ sessionStorage.setItem(SS_UNLOCKED, '1'); }catch(e){}
        state.unlocked = true;
        renderApp();
      } else {
        err.style.display = 'block';
        pw.value=''; pw.focus();
      }
    }
    document.getElementById('gate-btn').addEventListener('click', tryUnlock);
    pw.addEventListener('keydown', function(e){ if(e.key==='Enter') tryUnlock(); });
    pw.focus();
  }

  /* ---------------- connection settings ---------------- */
  function renderPengaturan(){
    var rc = getRepoConfig(), token = getToken();
    return '<div class="form-card" style="max-width:640px;">'+
      '<h3 class="form-title font-display" style="font-size:19px;">Koneksi GitHub</h3>'+
      '<p class="form-sub">Data disimpan sebagai commit langsung ke repo GitHub-mu. Token hanya tersimpan di browser ini, tidak pernah dikirim ke tempat lain selain GitHub.</p>'+
      '<div class="config-grid">'+
        '<div class="field"><label for="cfg-owner">Owner / Username</label><input class="input" id="cfg-owner" value="'+U.escapeHtml(rc.owner)+'" placeholder="mis. windi-tri"></div>'+
        '<div class="field"><label for="cfg-repo">Nama Repo</label><input class="input" id="cfg-repo" value="'+U.escapeHtml(rc.repo)+'" placeholder="mis. lembar"></div>'+
      '</div>'+
      '<div class="field"><label for="cfg-branch">Branch</label><input class="input" id="cfg-branch" value="'+U.escapeHtml(rc.branch)+'" placeholder="main"></div>'+
      '<div class="field"><label for="cfg-token">Personal Access Token</label><input class="input" id="cfg-token" type="password" value="'+U.escapeHtml(token)+'" placeholder="ghp_..."><p class="hint">Buat di GitHub &rarr; Settings &rarr; Developer settings &rarr; Fine-grained tokens. Batasi hanya ke repo ini, izin Contents: Read and write.</p></div>'+
      '<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">'+
        '<button class="btn btn-primary btn-sm" id="cfg-save">Simpan &amp; Sambungkan</button>'+
        '<button class="btn btn-ghost btn-sm" id="cfg-forget">Lupakan token</button>'+
        (state.connected? '<span class="pill-status pill-ok">'+MI.check+' Terhubung</span>' : (state.connectError? '<span class="pill-status pill-warn">'+U.escapeHtml(state.connectError)+'</span>' : ''))+
      '</div>'+
    '</div>';
  }

  function attachPengaturanHandlers(){
    var saveBtn = document.getElementById('cfg-save');
    if(!saveBtn) return;
    saveBtn.addEventListener('click', async function(){
      var owner = document.getElementById('cfg-owner').value.trim();
      var repo = document.getElementById('cfg-repo').value.trim();
      var branch = document.getElementById('cfg-branch').value.trim() || 'main';
      var token = document.getElementById('cfg-token').value.trim();
      setRepoConfig({owner:owner, repo:repo, branch:branch});
      setToken(token);
      saveBtn.disabled = true; saveBtn.textContent = 'Menyambungkan…';
      var result = await testConnection();
      saveBtn.disabled = false; saveBtn.textContent = 'Simpan & Sambungkan';
      if(result.ok){
        state.connected = true; state.connectError='';
        U.toast('Berhasil terhubung ke GitHub');
        await loadAllData();
      } else {
        state.connected = false; state.connectError = result.message;
        renderApp();
      }
    });
    document.getElementById('cfg-forget').addEventListener('click', function(){
      setToken('');
      state.connected = false;
      state.connectError = 'Token dihapus dari perangkat ini.';
      renderApp();
    });
  }

  /* ---------------- karya tab ---------------- */
  function renderKarya(){
    if(state.dataError){
      return '<div class="empty-state">'+MI.empty+'<h3>Gagal memuat data</h3><p>'+U.escapeHtml(state.dataError)+'</p></div>';
    }
    if(!state.dataLoaded){
      return '<div class="center-note">Memuat data dari GitHub…</div>';
    }
    var rows = state.karya.slice().sort(function(a,b){ return new Date(b.createdAt)-new Date(a.createdAt); });
    var html = '<div class="admin-bar"><div><h2 style="font-size:19px;">Karya ('+rows.length+')</h2></div><button class="btn btn-primary btn-sm" id="add-karya-btn">+ Tambah Karya</button></div>';
    if(rows.length===0){
      html += '<div class="empty-state">'+MI.empty+'<h3>Belum ada karya</h3><p>Tambahkan karya pertama, atau lihat kotak masuk email untuk kiriman dari pengunjung.</p></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Judul</th><th>Jenis</th><th>Penulis</th><th>Tanggal</th><th></th></tr></thead><tbody>';
      rows.forEach(function(k){
        html += '<tr>'+
          '<td class="t-title">'+U.escapeHtml(k.judul)+'</td>'+
          '<td>'+(CATS[k.jenis]?CATS[k.jenis].label:k.jenis)+'</td>'+
          '<td>'+U.escapeHtml(k.penulis)+'</td>'+
          '<td>'+U.fmtDateShort(k.createdAt)+'</td>'+
          '<td class="t-actions">'+
            '<button class="btn btn-ghost btn-sm" data-edit-karya="'+U.escapeHtml(k.id)+'">'+MI.edit+'</button>'+
            '<button class="btn btn-danger btn-sm" data-del-karya="'+U.escapeHtml(k.id)+'">'+MI.trash+'</button>'+
          '</td>'+
        '</tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  function karyaModal(existing){
    var isEdit = !!existing;
    var k = existing || {judul:'', jenis:'puisi', penulis:'', isi:''};
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal-box">'+
      '<h3 class="font-display" style="font-size:19px; margin-bottom:18px;">'+(isEdit?'Edit Karya':'Tambah Karya')+'</h3>'+
      '<div class="row-2">'+
        '<div class="field"><label>Judul</label><input class="input" id="m-judul" value="'+U.escapeHtml(k.judul)+'"></div>'+
        '<div class="field"><label>Jenis</label><select class="select" id="m-jenis">'+CAT_ORDER.map(function(c){return '<option value="'+c+'"'+(k.jenis===c?' selected':'')+'>'+CATS[c].label+'</option>';}).join('')+'</select></div>'+
      '</div>'+
      '<div class="field"><label>Nama Penulis</label><input class="input" id="m-penulis" value="'+U.escapeHtml(k.penulis)+'"></div>'+
      '<div class="field"><label>Isi Karya</label><textarea class="textarea" id="m-isi" style="min-height:200px;">'+U.escapeHtml(k.isi)+'</textarea></div>'+
      '<div style="display:flex; gap:10px; justify-content:flex-end;">'+
        '<button class="btn btn-ghost" id="m-cancel">Batal</button>'+
        '<button class="btn btn-primary" id="m-save">Simpan</button>'+
      '</div>'+
    '</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function(e){ if(e.target===backdrop) backdrop.remove(); });
    document.getElementById('m-cancel').addEventListener('click', function(){ backdrop.remove(); });
    document.getElementById('m-save').addEventListener('click', async function(){
      var judul = document.getElementById('m-judul').value.trim();
      var jenis = document.getElementById('m-jenis').value;
      var penulis = document.getElementById('m-penulis').value.trim();
      var isi = document.getElementById('m-isi').value.trim();
      if(!judul || !penulis || !isi){ U.toast('Lengkapi judul, penulis, dan isi karya', false); return; }
      var saveBtn = document.getElementById('m-save');
      saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan…';
      try{
        var list = state.karya.slice();
        var penulisSlug = U.slugify(penulis);
        if(isEdit){
          var idx = list.findIndex(function(x){ return x.id===k.id; });
          list[idx] = Object.assign({}, list[idx], {judul:judul, jenis:jenis, penulis:penulis, penulisSlug:penulisSlug, isi:isi});
        } else {
          list.unshift({ id:U.uid(), judul:judul, jenis:jenis, penulis:penulis, penulisSlug:penulisSlug, isi:isi, createdAt:new Date().toISOString() });
        }
        await saveKarya(list, (isEdit?'Edit karya: ':'Tambah karya: ')+judul);
        var stub = ensurePenulisStub(penulis);
        if(stub){ await savePenulis(stub, 'Tambah profil penulis: '+penulis); }
        backdrop.remove();
        U.toast('Karya berhasil disimpan. Perubahan tampil di situs dalam ~1 menit.');
        renderApp();
      }catch(e){
        U.toast(e.message, false);
        saveBtn.disabled = false; saveBtn.textContent = 'Simpan';
      }
    });
  }

  function attachKaryaHandlers(){
    var addBtn = document.getElementById('add-karya-btn');
    if(addBtn) addBtn.addEventListener('click', function(){ karyaModal(null); });
    document.querySelectorAll('[data-edit-karya]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-edit-karya');
        var k = state.karya.find(function(x){ return x.id===id; });
        if(k) karyaModal(k);
      });
    });
    document.querySelectorAll('[data-del-karya]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var id = btn.getAttribute('data-del-karya');
        var k = state.karya.find(function(x){ return x.id===id; });
        if(!k) return;
        if(!confirm('Hapus karya "'+k.judul+'"? Tindakan ini tidak bisa dibatalkan.')) return;
        btn.disabled = true;
        try{
          var list = state.karya.filter(function(x){ return x.id!==id; });
          await saveKarya(list, 'Hapus karya: '+k.judul);
          U.toast('Karya berhasil dihapus');
          renderApp();
        }catch(e){
          U.toast(e.message, false);
          btn.disabled = false;
        }
      });
    });
  }

  /* ---------------- penulis tab ---------------- */
  function renderPenulis(){
    if(state.dataError){
      return '<div class="empty-state">'+MI.empty+'<h3>Gagal memuat data</h3><p>'+U.escapeHtml(state.dataError)+'</p></div>';
    }
    if(!state.dataLoaded){
      return '<div class="center-note">Memuat data dari GitHub…</div>';
    }
    var slugs = Object.keys(state.penulis);
    state.karya.forEach(function(k){ if(k.penulisSlug && slugs.indexOf(k.penulisSlug)===-1) slugs.push(k.penulisSlug); });
    var html = '<div class="admin-bar"><div><h2 style="font-size:19px;">Penulis ('+slugs.length+')</h2></div><button class="btn btn-primary btn-sm" id="add-penulis-btn">+ Tambah Penulis</button></div>';
    if(slugs.length===0){
      html += '<div class="empty-state">'+MI.empty+'<h3>Belum ada penulis</h3><p>Profil penulis otomatis dibuat saat kamu menambahkan karya.</p></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="admin-table"><thead><tr><th>Nama</th><th>Jumlah Karya</th><th>Kontak</th><th></th></tr></thead><tbody>';
      slugs.forEach(function(slug){
        var p = state.penulis[slug] || {nama:slug};
        var count = state.karya.filter(function(k){ return k.penulisSlug===slug; }).length;
        html += '<tr>'+
          '<td class="t-title">'+U.escapeHtml(p.nama||slug)+'</td>'+
          '<td>'+count+'</td>'+
          '<td>'+U.escapeHtml(p.email||'—')+'</td>'+
          '<td class="t-actions"><button class="btn btn-ghost btn-sm" data-edit-penulis="'+U.escapeHtml(slug)+'">'+MI.edit+'</button></td>'+
        '</tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  function penulisModal(slug){
    var isEdit = !!slug;
    var p = (isEdit && state.penulis[slug]) || {nama:'', role:'', bio:'', email:'', instagram:'', linkedin:''};
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal-box">'+
      '<h3 class="font-display" style="font-size:19px; margin-bottom:18px;">'+(isEdit?'Edit Penulis':'Tambah Penulis')+'</h3>'+
      '<div class="field"><label>Nama</label><input class="input" id="pm-nama" value="'+U.escapeHtml(p.nama)+'"'+(isEdit?' readonly':'')+'></div>'+
      '<div class="field"><label>Peran / Status</label><input class="input" id="pm-role" value="'+U.escapeHtml(p.role||'')+'" placeholder="Mis. Mahasiswa | Penulis Pemula"></div>'+
      '<div class="field"><label>Bio Singkat</label><textarea class="textarea" id="pm-bio" style="min-height:110px;">'+U.escapeHtml(p.bio||'')+'</textarea></div>'+
      '<div class="row-2">'+
        '<div class="field"><label>Email</label><input class="input" id="pm-email" value="'+U.escapeHtml(p.email||'')+'"></div>'+
        '<div class="field"><label>Instagram</label><input class="input" id="pm-ig" value="'+U.escapeHtml(p.instagram||'')+'"></div>'+
      '</div>'+
      '<div class="field"><label>LinkedIn</label><input class="input" id="pm-li" value="'+U.escapeHtml(p.linkedin||'')+'"></div>'+
      '<div style="display:flex; gap:10px; justify-content:flex-end;">'+
        '<button class="btn btn-ghost" id="pm-cancel">Batal</button>'+
        '<button class="btn btn-primary" id="pm-save">Simpan</button>'+
      '</div>'+
    '</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function(e){ if(e.target===backdrop) backdrop.remove(); });
    document.getElementById('pm-cancel').addEventListener('click', function(){ backdrop.remove(); });
    document.getElementById('pm-save').addEventListener('click', async function(){
      var nama = document.getElementById('pm-nama').value.trim();
      if(!nama){ U.toast('Nama wajib diisi', false); return; }
      var theSlug = isEdit ? slug : U.slugify(nama);
      var data = {
        nama: nama,
        role: document.getElementById('pm-role').value.trim(),
        bio: document.getElementById('pm-bio').value.trim(),
        email: document.getElementById('pm-email').value.trim(),
        instagram: document.getElementById('pm-ig').value.trim(),
        linkedin: document.getElementById('pm-li').value.trim()
      };
      var saveBtn = document.getElementById('pm-save');
      saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan…';
      try{
        var map = Object.assign({}, state.penulis);
        map[theSlug] = data;
        await savePenulis(map, (isEdit?'Edit penulis: ':'Tambah penulis: ')+nama);
        backdrop.remove();
        U.toast('Profil penulis berhasil disimpan.');
        renderApp();
      }catch(e){
        U.toast(e.message, false);
        saveBtn.disabled = false; saveBtn.textContent = 'Simpan';
      }
    });
  }

  function attachPenulisHandlers(){
    var addBtn = document.getElementById('add-penulis-btn');
    if(addBtn) addBtn.addEventListener('click', function(){ penulisModal(null); });
    document.querySelectorAll('[data-edit-penulis]').forEach(function(btn){
      btn.addEventListener('click', function(){ penulisModal(btn.getAttribute('data-edit-penulis')); });
    });
  }

  /* ---------------- app shell ---------------- */
  function renderApp(){
    var root = document.getElementById('admin-root');
    if(!state.unlocked){ renderGate(); return; }

    var rc = getRepoConfig();
    var needsSetup = !rc.owner || !rc.repo || !getToken();

    var html = '<div class="site-header" style="position:static;"><div class="header-inner wrap" style="max-width:1080px; margin-inline:auto; padding-inline:0;">'+
      '<a href="../index.html" class="brand"><svg viewBox="0 0 28 28" width="28" height="28" fill="none"><path d="M4 8c4-2.2 8-2.2 10 0 2-2.2 6-2.2 10 0v13c-4-2.2-8-2.2-10 0-2-2.2-6-2.2-10 0Z" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 8v13" stroke="var(--ink)" stroke-width="1.6"/></svg>'+
      '<span class="brand-text"><b>Lembar</b><span>Panel Admin</span></span></a>'+
      '<div class="header-actions"><a href="../index.html" class="btn btn-ghost btn-sm" target="_blank" rel="noopener">Lihat Situs &rarr;</a><button class="btn btn-outline btn-sm" id="lock-btn">Kunci</button></div>'+
    '</div></div>';

    html += '<div class="admin-shell">';
    if(needsSetup){
      html += renderPengaturan();
    } else {
      html += '<div class="admin-tabs">'+
        '<button class="admin-tab'+(state.tab==='karya'?' active':'')+'" data-tab="karya">Karya</button>'+
        '<button class="admin-tab'+(state.tab==='penulis'?' active':'')+'" data-tab="penulis">Penulis</button>'+
        '<button class="admin-tab'+(state.tab==='pengaturan'?' active':'')+'" data-tab="pengaturan">Pengaturan</button>'+
      '</div>';
      if(state.tab==='karya') html += renderKarya();
      else if(state.tab==='penulis') html += renderPenulis();
      else html += renderPengaturan();
    }
    html += '</div>';

    root.innerHTML = html;

    document.getElementById('lock-btn').addEventListener('click', function(){
      try{ sessionStorage.removeItem(SS_UNLOCKED); }catch(e){}
      state.unlocked = false;
      renderApp();
    });

    document.querySelectorAll('.admin-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ state.tab = btn.getAttribute('data-tab'); renderApp(); });
    });

    if(needsSetup || state.tab==='pengaturan') attachPengaturanHandlers();
    if(!needsSetup && state.tab==='karya') attachKaryaHandlers();
    if(!needsSetup && state.tab==='penulis') attachPenulisHandlers();

    if(!needsSetup && !state.dataLoaded && !state.dataError && state.connected===false){
      // first time reaching dashboard this session with saved creds — verify + load
      verifyThenLoad();
    }
  }

  async function verifyThenLoad(){
    var result = await testConnection();
    if(result.ok){
      state.connected = true;
      await loadAllData();
    } else {
      state.connected = false;
      state.connectError = result.message;
      renderApp();
    }
  }

  /* ---------------- init ---------------- */
  document.addEventListener('DOMContentLoaded', function(){
    try{ state.unlocked = sessionStorage.getItem(SS_UNLOCKED)==='1'; }catch(e){ state.unlocked = false; }
    renderApp();
    var rc = getRepoConfig();
    if(state.unlocked && rc.owner && rc.repo && getToken()){
      verifyThenLoad();
    }
  });
})();
