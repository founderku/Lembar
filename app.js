/* Lembar — public site logic (static, reads data/karya.json + data/penulis.json) */
(function(){
  "use strict";
  var ICON = window.LembarIcons, MI = window.LembarIconsMisc, U = window.LembarUtil;
  var CATS = window.LembarCats, CAT_ORDER = window.LembarCatOrder;
  var CFG = window.LEMBAR_CONFIG || {adminEmail:'', github:{}};

  var state = { karya: [], penulis: {}, loaded: false, error: false };

  function catMeta(key){ return CATS[key] || CATS.lainnya; }
  function catIcon(key){ return ICON[key] || ICON.lainnya; }

  /* ---------------- data loading ---------------- */
  async function loadData(){
    try{
      var base = document.body.getAttribute('data-base') || '.';
      var res = await fetch(base + '/data/karya.json', {cache:'no-store'});
      var karya = res.ok ? await res.json() : [];
      var res2 = await fetch(base + '/data/penulis.json', {cache:'no-store'});
      var penulis = res2.ok ? await res2.json() : {};
      karya.sort(function(a,b){ return new Date(b.createdAt) - new Date(a.createdAt); });
      state.karya = karya;
      state.penulis = penulis || {};
      state.loaded = true;
    }catch(e){
      state.error = true; state.loaded = true;
    }
    render();
  }

  /* ---------------- routing ---------------- */
  function parseRoute(){
    var raw = location.hash.replace(/^#\/?/, '');
    var qIdx = raw.indexOf('?');
    var pathPart = qIdx===-1? raw : raw.slice(0,qIdx);
    var queryPart = qIdx===-1? '' : raw.slice(qIdx+1);
    var segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
    var params = new URLSearchParams(queryPart);
    if(segs.length===0) return {name:'beranda'};
    if(segs[0]==='karya' && segs.length===1) return {name:'daftar', kategori:params.get('kategori')||'semua', q:params.get('q')||''};
    if(segs[0]==='karya' && segs.length===2) return {name:'detail', id:segs[1]};
    if(segs[0]==='profil' && segs.length===2) return {name:'profil', slug:segs[1]};
    if(segs[0]==='unggah') return {name:'unggah'};
    if(segs[0]==='tentang') return {name:'tentang'};
    return {name:'notfound'};
  }

  /* ---------------- shared render bits ---------------- */
  function badge(kategori){
    return '<span class="badge">'+catIcon(kategori)+'<span>'+U.escapeHtml(catMeta(kategori).label)+'</span></span>';
  }
  function karyaCard(k){
    return ''+
    '<article class="karya-card">'+
      '<a href="#/karya/'+encodeURIComponent(k.id)+'" aria-label="'+U.escapeHtml(k.judul)+'">'+
        '<div class="karya-cover">'+catIcon(k.jenis)+'<span class="badge">'+catIcon(k.jenis)+'<span>'+U.escapeHtml(catMeta(k.jenis).label)+'</span></span></div>'+
      '</a>'+
      '<div class="karya-body">'+
        '<h3><a href="#/karya/'+encodeURIComponent(k.id)+'">'+U.escapeHtml(k.judul)+'</a></h3>'+
        '<p class="karya-excerpt">'+U.escapeHtml(U.excerpt(k.isi, 110))+'</p>'+
        '<div class="karya-meta">'+
          '<a href="#/profil/'+encodeURIComponent(k.penulisSlug)+'">'+U.escapeHtml(k.penulis)+'</a>'+
          '<span class="dot"></span><span>'+U.fmtDateShort(k.createdAt)+'</span>'+
        '</div>'+
      '</div>'+
    '</article>';
  }
  function emptyState(title, sub, showCta){
    return '<div class="empty-state">'+MI.empty+'<h3>'+U.escapeHtml(title)+'</h3><p>'+U.escapeHtml(sub)+'</p>'+
      (showCta? '<a href="#/unggah" class="btn btn-primary btn-sm">Kirim Karya Pertama</a>' : '')+
    '</div>';
  }

  /* ---------------- views ---------------- */
  function viewBeranda(){
    var terbaru = state.karya.slice(0,4);
    var counts = {};
    state.karya.forEach(function(k){ counts[k.jenis] = (counts[k.jenis]||0)+1; });

    var html = '';
    html += '<section class="hero"><div class="wrap hero-grid">'+
      '<div><h1>Tempat untuk menyimpan dan menampilkan karya tulis kamu.</h1>'+
      '<p class="lede">Ubah setiap tulisan jadi portofolio yang bisa kamu banggakan &mdash; mulai dari puisi, cerpen, esai, artikel, hingga naskah. Kirim karyamu, bagikan tautan profilmu.</p>'+
      '<div class="hero-cta"><a href="#/karya" class="btn btn-primary">Jelajahi Karya</a><a href="#/unggah" class="btn btn-outline">Kirim Karya</a></div></div>'+
      '<div class="hero-art">'+ICON.cerpen+'</div>'+
    '</div></section>';

    html += '<section class="wrap"><div class="section-head"><h2>Karya Terbaru</h2>'+(state.karya.length>4?'<a href="#/karya">Lihat semua</a>':'')+'</div>';
    if(!state.loaded){
      html += '<div class="center-note">Memuat karya…</div>';
    } else if(state.error){
      html += emptyState('Gagal memuat data', 'Periksa koneksi internet kamu, lalu muat ulang halaman.', false);
    } else if(terbaru.length===0){
      html += emptyState('Belum ada karya di sini', 'Jadilah yang pertama membagikan tulisanmu di Lembar.', true);
    } else {
      html += '<div class="karya-grid">'+terbaru.map(karyaCard).join('')+'</div>';
    }
    html += '</section>';

    html += '<section class="wrap"><div class="section-head"><h2>Jelajahi Kategori</h2></div>'+
      '<div class="cat-grid">'+CAT_ORDER.map(function(c){
        return '<a class="cat-card" href="#/karya?kategori='+c+'"><span class="cat-ic">'+catIcon(c)+'</span><b>'+CATS[c].label+'</b><span>'+(counts[c]||0)+' karya</span></a>';
      }).join('')+'</div>'+
    '</section>';
    return html;
  }

  function viewDaftar(route){
    var kategori = route.kategori || 'semua';
    var q = (route.q||'').toLowerCase().trim();
    var counts = {semua: state.karya.length};
    state.karya.forEach(function(k){ counts[k.jenis] = (counts[k.jenis]||0)+1; });

    var filtered = state.karya.filter(function(k){
      if(kategori!=='semua' && k.jenis!==kategori) return false;
      if(q && (k.judul||'').toLowerCase().indexOf(q)===-1 && (k.penulis||'').toLowerCase().indexOf(q)===-1) return false;
      return true;
    });

    var html = '<div class="wrap listing">';
    html += '<aside class="filter-box"><h4>Kategori</h4>'+
      '<a class="filter-item'+(kategori==='semua'?' active':'')+'" href="#/karya'+(q?'?q='+encodeURIComponent(q):'')+'">Semua<small>'+counts.semua+'</small></a>'+
      CAT_ORDER.map(function(c){
        var href = '#/karya?kategori='+c+(q?'&q='+encodeURIComponent(q):'');
        return '<a class="filter-item'+(kategori===c?' active':'')+'" href="'+href+'">'+CATS[c].label+'<small>'+(counts[c]||0)+'</small></a>';
      }).join('')+
    '</aside>';

    html += '<div>';
    html += '<div class="chip-scroll">'+
      '<a class="chip'+(kategori==='semua'?' active':'')+'" href="#/karya'+(q?'?q='+encodeURIComponent(q):'')+'">Semua</a>'+
      CAT_ORDER.map(function(c){
        var href = '#/karya?kategori='+c+(q?'&q='+encodeURIComponent(q):'');
        return '<a class="chip'+(kategori===c?' active':'')+'" href="'+href+'">'+CATS[c].label+'</a>';
      }).join('')+
    '</div>';
    html += '<div class="search-row"><label class="search-box">'+MI.search+'<input id="search-input" type="text" placeholder="Cari judul atau nama penulis…" value="'+U.escapeHtml(route.q||'')+'"></label></div>';

    if(!state.loaded){
      html += '<div class="center-note">Memuat karya…</div>';
    } else if(filtered.length===0){
      html += state.karya.length===0
        ? emptyState('Belum ada karya di sini', 'Jadilah yang pertama membagikan tulisanmu di Lembar.', true)
        : emptyState('Tidak ditemukan', 'Coba kategori lain atau kata kunci pencarian yang berbeda.', false);
    } else {
      html += '<div class="karya-grid">'+filtered.map(karyaCard).join('')+'</div>';
    }
    html += '</div></div>';
    return html;
  }

  function viewDetail(route){
    if(!state.loaded) return '<div class="center-note">Memuat karya…</div>';
    var k = state.karya.find(function(x){ return x.id===route.id; });
    if(!k){
      return '<div class="detail-wrap"><a href="#/karya" class="back-link">'+MI.back+' Kembali ke daftar</a>'+
        emptyState('Karya tidak ditemukan', 'Karya ini mungkin sudah dihapus atau tautannya salah.', false)+'</div>';
    }
    var html = '<div class="detail-wrap">';
    html += '<a href="#/karya" class="back-link">'+MI.back+' Kembali ke daftar</a>';
    html += '<div class="detail-cover">'+catIcon(k.jenis)+'</div>';
    html += '<div style="margin-bottom:14px;">'+badge(k.jenis)+'</div>';
    html += '<h1 class="detail-title">'+U.escapeHtml(k.judul)+'</h1>';
    html += '<div class="detail-meta">oleh <a href="#/profil/'+encodeURIComponent(k.penulisSlug)+'">'+U.escapeHtml(k.penulis)+'</a><span class="dot"></span><span>'+U.fmtDateLong(k.createdAt)+'</span></div>';
    html += '<div class="detail-body">'+U.escapeHtml(k.isi)+'</div>';
    html += '<p class="divider-line footer-tagline" style="margin-top:40px; font-size:13.5px;">Setiap tulisan punya cerita, dan setiap cerita layak untuk dibagikan.</p>';
    html += '</div>';
    return html;
  }

  function viewProfil(route){
    if(!state.loaded) return '<div class="center-note">Memuat profil…</div>';
    var slug = route.slug;
    var works = state.karya.filter(function(k){ return k.penulisSlug===slug; });
    var profil = state.penulis[slug] || null;
    var displayName = (profil && profil.nama) || (works[0] && works[0].penulis) ||
      slug.replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
    var counts = {};
    works.forEach(function(k){ counts[k.jenis]=(counts[k.jenis]||0)+1; });

    var html = '<div class="wrap profil-wrap">';
    html += '<div class="profil-head"><div class="avatar">'+U.initials(displayName)+'</div><div><h1 class="profil-name">'+U.escapeHtml(displayName)+'</h1><p class="profil-role">'+U.escapeHtml((profil&&profil.role)||'Penulis di Lembar')+'</p></div></div>';
    html += '<p class="profil-bio">'+(profil&&profil.bio? U.escapeHtml(profil.bio) : '<span style="color:var(--ink-faint)">Belum ada bio.</span>')+'</p>';

    html += '<div class="profil-grid">';
    html += '<div class="profil-card"><h4>Karya Saya ('+works.length+')</h4>';
    if(works.length===0){
      html += '<p style="font-size:13.5px; color:var(--ink-faint);">Belum ada karya yang diunggah.</p>';
    } else {
      html += works.slice(0,10).map(function(k){
        return '<div class="work-row">'+badge(k.jenis)+'<a href="#/karya/'+encodeURIComponent(k.id)+'">'+U.escapeHtml(k.judul)+'</a></div>';
      }).join('');
    }
    html += '</div>';

    html += '<div>';
    html += '<div class="profil-card" style="margin-bottom:20px;"><h4>Ringkasan Karya</h4>'+
      CAT_ORDER.filter(function(c){return counts[c];}).map(function(c){
        return '<div class="cat-count-row">'+CATS[c].label+'<b>'+counts[c]+'</b></div>';
      }).join('') + (works.length===0? '<p style="font-size:13px;color:var(--ink-faint);">&mdash;</p>':'') +
    '</div>';
    html += '<div class="profil-card"><h4>Kontak</h4>';
    var hasContact = profil && (profil.email||profil.instagram||profil.linkedin);
    if(hasContact){
      if(profil.email) html += '<div class="contact-row">'+MI.mail+'<span>'+U.escapeHtml(profil.email)+'</span></div>';
      if(profil.instagram) html += '<div class="contact-row">'+MI.at+'<span>'+U.escapeHtml(profil.instagram)+'</span></div>';
      if(profil.linkedin) html += '<div class="contact-row">'+MI.link+'<span>'+U.escapeHtml(profil.linkedin)+'</span></div>';
    } else {
      html += '<p style="font-size:13px;color:var(--ink-faint);">Belum ada info kontak.</p>';
    }
    html += '</div></div>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function viewUnggah(){
    var html = '<div class="wrap form-wrap"><div class="form-card">'+
      '<h1 class="form-title font-display">Kirim Karya</h1>'+
      '<p class="form-sub">Situs ini statis (tanpa server), jadi karyamu belum bisa langsung tersimpan otomatis. Isi form di bawah, lalu klik <b>Kirim lewat Email</b> &mdash; aplikasi email kamu akan terbuka dengan isian yang sudah rapi, tinggal dikirim. Admin akan menambahkannya ke situs setelah diperiksa.</p>'+
      '<form id="unggah-form" novalidate>'+
        '<div class="field" id="f-nama"><label for="in-nama">Nama Penulis</label><input class="input" id="in-nama" type="text" maxlength="60" placeholder="Nama lengkap kamu"><div class="err">Nama penulis wajib diisi.</div></div>'+
        '<div class="row-2">'+
          '<div class="field" id="f-judul"><label for="in-judul">Judul Karya</label><input class="input" id="in-judul" type="text" maxlength="120" placeholder="Judul karya kamu"><div class="err">Judul wajib diisi.</div></div>'+
          '<div class="field" id="f-jenis"><label for="in-jenis">Jenis Karya</label><select class="select" id="in-jenis">'+
            CAT_ORDER.map(function(c){return '<option value="'+c+'">'+CATS[c].label+'</option>';}).join('')+
          '</select></div>'+
        '</div>'+
        '<div class="field" id="f-isi"><label for="in-isi">Isi Karya</label><textarea class="textarea" id="in-isi" maxlength="8000" placeholder="Tulis atau tempel isi karyamu di sini…"></textarea><div class="char-count"><span id="char-count">0</span>/8000</div><div class="err">Isi karya wajib diisi.</div></div>'+
        '<div style="display:flex; gap:10px; justify-content:flex-end; margin-top:8px; flex-wrap:wrap;">'+
          '<a href="#/karya" class="btn btn-ghost">Batal</a>'+
          '<button type="submit" class="btn btn-primary" id="submit-btn">'+MI.mail+' Kirim lewat Email</button>'+
        '</div>'+
      '</form>'+
    '</div></div>';
    return html;
  }

  function viewTentang(){
    return '<div class="wrap form-wrap" style="max-width:720px;">'+
      '<h1 class="font-display" style="font-size:clamp(26px,4vw,36px); margin-bottom:18px;">Tentang Lembar</h1>'+
      '<p style="font-size:15.5px; line-height:1.75; color:var(--ink-soft); margin-bottom:18px;">Lembar dibuat untuk mahasiswa dan penulis pemula yang ingin mengumpulkan karya tulis sebagai portofolio &mdash; tempat puisi, cerpen, esai, artikel, dan naskah tersimpan rapi dalam satu halaman.</p>'+
      '<p style="font-size:15.5px; line-height:1.75; color:var(--ink-soft); margin-bottom:18px;">Kalau kamu ingin menunjukkan kemampuan menulismu, cukup bagikan tautan profil Lembar kamu &mdash; semua karyamu akan tampil rapi di satu tempat, tanpa perlu mengirim banyak berkas terpisah.</p>'+
      '<div class="profil-card" style="margin-top:28px;"><h4>Cara Kerja</h4>'+
        '<div class="cat-count-row"><span>1. Tulis karyamu &mdash; puisi, cerpen, esai, artikel, atau naskah.</span></div>'+
        '<div class="cat-count-row"><span>2. Kirim lewat halaman Kirim Karya.</span></div>'+
        '<div class="cat-count-row"><span>3. Admin memeriksa lalu menerbitkannya di situs.</span></div>'+
        '<div class="cat-count-row"><span>4. Bagikan tautan profilmu sebagai portofolio.</span></div>'+
      '</div>'+
      '<div style="margin-top:28px;"><a href="#/unggah" class="btn btn-primary">Kirim Karya Sekarang</a></div>'+
    '</div>';
  }

  /* ---------------- form handlers ---------------- */
  function attachUnggahHandlers(){
    var form = document.getElementById('unggah-form');
    if(!form) return;
    var isiEl = document.getElementById('in-isi');
    var countEl = document.getElementById('char-count');
    isiEl.addEventListener('input', function(){ countEl.textContent = isiEl.value.length; });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var nama = document.getElementById('in-nama').value.trim();
      var judul = document.getElementById('in-judul').value.trim();
      var jenis = document.getElementById('in-jenis').value;
      var isi = document.getElementById('in-isi').value.trim();

      ['f-nama','f-judul','f-isi'].forEach(function(id){ document.getElementById(id).classList.remove('invalid'); });
      var ok = true;
      if(!nama){ document.getElementById('f-nama').classList.add('invalid'); ok=false; }
      if(!judul){ document.getElementById('f-judul').classList.add('invalid'); ok=false; }
      if(!isi){ document.getElementById('f-isi').classList.add('invalid'); ok=false; }
      if(!ok) return;

      var subject = 'Kirim Karya Lembar: ' + judul;
      var body = 'Nama Penulis: ' + nama + '\n' +
                 'Jenis Karya: ' + (CATS[jenis]?CATS[jenis].label:jenis) + '\n\n' +
                 'Isi Karya:\n' + isi + '\n';
      var mailto = 'mailto:' + encodeURIComponent(CFG.adminEmail) +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      window.location.href = mailto;
      U.toast('Membuka aplikasi email kamu…');
    });
  }

  function attachDaftarHandlers(route){
    var input = document.getElementById('search-input');
    if(!input) return;
    var timer;
    input.addEventListener('input', function(){
      clearTimeout(timer);
      timer = setTimeout(function(){
        var params = new URLSearchParams();
        if(route.kategori && route.kategori!=='semua') params.set('kategori', route.kategori);
        if(input.value.trim()) params.set('q', input.value.trim());
        var qs = params.toString();
        history.replaceState(null,'', '#/karya'+(qs?'?'+qs:''));
        render();
        setTimeout(function(){ var i2=document.getElementById('search-input'); if(i2){ i2.focus(); i2.setSelectionRange(i2.value.length,i2.value.length); } },0);
      }, 220);
    });
  }

  /* ---------------- main render ---------------- */
  function render(){
    var route = parseRoute();
    var view = document.getElementById('view');
    if(!view) return;
    var html = '';
    switch(route.name){
      case 'beranda': html = viewBeranda(); break;
      case 'daftar': html = viewDaftar(route); break;
      case 'detail': html = viewDetail(route); break;
      case 'profil': html = viewProfil(route); break;
      case 'unggah': html = viewUnggah(); break;
      case 'tentang': html = viewTentang(); break;
      default: html = '<div class="wrap"><div class="empty-state" style="margin-block:60px;">'+MI.empty+'<h3>Halaman tidak ditemukan</h3><p>Halaman yang kamu cari tidak tersedia.</p><a href="#/" class="btn btn-primary btn-sm">Kembali ke Beranda</a></div></div>';
    }
    view.innerHTML = html;

    var navMap = {beranda:'beranda', daftar:'daftar', detail:'daftar', tentang:'tentang'};
    var activeKey = navMap[route.name];
    document.querySelectorAll('#main-nav a').forEach(function(a){
      a.classList.toggle('active', a.getAttribute('data-route')===activeKey);
    });
    var navCheck = document.getElementById('nav-check');
    if(navCheck) navCheck.checked = false;

    if(route.name==='daftar') attachDaftarHandlers(route);
    if(route.name==='unggah') attachUnggahHandlers();

    window.scrollTo({top:0, behavior:'auto'});
  }

  /* ---------------- theme toggle ---------------- */
  function initTheme(){
    var btn = document.getElementById('theme-toggle');
    if(!btn) return;
    var saved = null;
    try{ saved = localStorage.getItem('lembar_theme'); }catch(e){}
    if(saved) document.documentElement.setAttribute('data-theme', saved);
    function paintIcon(){
      var isDark = document.documentElement.getAttribute('data-theme')==='dark' ||
        (!document.documentElement.hasAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      btn.innerHTML = isDark ? MI.sun : MI.moon;
    }
    paintIcon();
    btn.addEventListener('click', function(){
      var cur = document.documentElement.getAttribute('data-theme');
      var isDarkNow = cur==='dark' || (!cur && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = isDarkNow ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try{ localStorage.setItem('lembar_theme', next); }catch(e){}
      paintIcon();
    });
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', function(){
    initTheme();
    render();
    loadData();
  });
})();
