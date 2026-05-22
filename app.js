/**
 * ============================================================
 * LAURETTE FUGAIN × BDS — app.js v3 (clean rewrite)
 * ============================================================
 * IMPORTANT : ne pas nommer la variable 'supabase' —
 * conflit avec le global CDN window.supabase
 * ============================================================
 */

// ── 1. CONFIG ────────────────────────────────────────────────
const SB_URL = 'https://lhelfggczeybornhemsf.supabase.co';
const SB_KEY = 'REMPLACE_PAR_TA_CLE_ANON'; // ← clé eyJ... depuis Settings > API

const ANNUAL_GOAL = 100; // objectif annuel d'inscriptions

// ── 2. CLIENT SUPABASE ───────────────────────────────────────
// On utilise '_db' pour éviter tout conflit avec window.supabase (CDN)
let _db;
try {
    _db = window.supabase.createClient(SB_URL, SB_KEY);
    window._dbClient = _db;
} catch (e) {
    console.error('[Supabase] init failed:', e);
}

// ── 3. ÉTAT GLOBAL ───────────────────────────────────────────
const State = {
    user:          null,
    profile:       null,
    bdsId:         null,
    events:        [],
    registrations: [],
    faqs:          [],
    currentView:   'dashboard',
};

// ── 4. CACHE DOM ─────────────────────────────────────────────
const el = id => document.getElementById(id);
const D = {
    authView:    el('view-auth'),
    appShell:    el('app-shell'),
    sections:    document.querySelectorAll('.view-section'),
    navItems:    document.querySelectorAll('.nav-item'),

    // Auth
    authErr:     el('auth-error-message'),
    authErrTxt:  el('auth-error-text'),
    authBtn:     el('auth-submit-btn'),
    togglePwd:   el('toggle-password'),

    // Sidebar
    sidebarName: el('sidebar-user-name'),
    sidebarBds:  el('sidebar-bds-name'),
    sidebarAvt:  el('sidebar-avatar'),
    logoutBtn:   el('btn-logout'),
    headerTitle: el('header-title'),

    // Dashboard
    dashReg:      el('dash-reg-count'),
    dashProgress: el('dash-reg-progress'),
    dashProgTxt:  el('dash-reg-progress-text'),
    dashEvents:   el('dash-event-count'),
    dashRank:     el('dash-rank'),
    dashRankHint: el('dash-rank-hint'),
    dashChart:    el('dash-chart-container'),
    dashUpcoming: el('dash-recent-events'),

    // Events
    eventsBody:  el('events-table-body'),
    btnCreate:   el('btn-create-event'),

    // Registrations
    regBody:     el('registrations-table-body'),
    regSearch:   el('reg-search'),
    regFilter:   el('reg-filter-status'),
    regExport:   el('btn-export-reg'),
    regLabel:    el('reg-count-label'),
    regBadge:    el('badge-registrations'),

    // Leaderboard
    lbPodium:    el('leaderboard-podium'),
    lbBody:      el('leaderboard-table-body'),
    lbCount:     el('leaderboard-count'),

    // FAQ
    faqBox:      el('faq-accordion-container'),

    // Modals
    modalEvent:  el('modal-event'),
    modalReg:    el('modal-registration'),
    formEvent:   el('form-create-event'),
    formReg:     el('form-registration'),
    evtBackdrop: el('modal-event-backdrop'),
    regBackdrop: el('modal-reg-backdrop'),

    // Toast
    toasts:      el('toast-container'),
    btnAdd:      el('btn-global-add'),
};

// ── 5. TOASTS ────────────────────────────────────────────────
function toast(msg, type = 'success') {
    if (!D.toasts) return;
    const icons = {
        success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
    };
    const colors = {
        success: 'bg-gray-900 text-white',
        error:   'bg-red-600 text-white',
        warning: 'bg-amber-500 text-white',
        info:    'bg-laurette-700 text-white',
    };
    const t = document.createElement('div');
    t.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-floating text-sm font-semibold toast-enter ${colors[type] || colors.success}`;
    t.innerHTML = `<span>${icons[type] || '✓'}</span><span>${msg}</span>`;
    D.toasts.appendChild(t);
    setTimeout(() => { t.classList.add('toast-exit'); t.addEventListener('animationend', () => t.remove()); }, 4000);
}

// ── 6. AUTH ──────────────────────────────────────────────────
async function initAuth() {
    if (!_db) {
        showError('Impossible de contacter le serveur Supabase.');
        return;
    }

    // Session existante ?
    const { data: { session } } = await _db.auth.getSession();
    if (session) {
        await onLogin(session.user);
    }

    // Écouter les changements d'auth
    _db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await onLogin(session.user);
        } else if (event === 'SIGNED_OUT') {
            onLogout();
        }
    });
}

async function onLogin(user) {
    State.user = user;
    D.authView.classList.add('hidden');
    D.appShell.classList.remove('hidden');
    await loadProfile();
    goTo('dashboard');
}

function onLogout() {
    State.user = State.profile = State.bdsId = null;
    D.appShell.classList.add('hidden');
    D.authView.classList.remove('hidden');
    if (D.authBtn) { D.authBtn.textContent = 'Accéder à mon espace'; D.authBtn.disabled = false; }
}

function showError(msg) {
    if (D.authErr) D.authErr.classList.remove('hidden');
    if (D.authErrTxt) D.authErrTxt.textContent = msg;
}

// Exposée en global pour le bouton inline du HTML
window.handleLogin = async function() {
    const email = el('email')?.value.trim();
    const pwd   = el('password')?.value;
    if (!email || !pwd) { showError('Remplis tous les champs.'); return; }
    if (!_db) { showError('Serveur inaccessible.'); return; }

    D.authBtn.disabled = true;
    D.authBtn.innerHTML = '<svg class="animate-spin h-4 w-4 text-white inline mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Connexion…';
    if (D.authErr) D.authErr.classList.add('hidden');

    const { error } = await _db.auth.signInWithPassword({ email, password: pwd });

    if (error) {
        showError(error.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect.'
            : error.message);
        D.authBtn.disabled = false;
        D.authBtn.textContent = 'Accéder à mon espace';
    }
    // Si succès → onAuthStateChange déclenche onLogin automatiquement
};

// ── 7. PROFIL ────────────────────────────────────────────────
async function loadProfile() {
    if (!State.user || !_db) return;

    const { data, error } = await _db
        .from('profiles')
        .select('id, full_name, role, bds_id, bds(name, city)')
        .eq('id', State.user.id)
        .single();

    if (error) {
        console.error('[loadProfile] error:', error);
        // Essai sans join si le join échoue
        const { data: p2 } = await _db.from('profiles').select('*').eq('id', State.user.id).single();
        if (p2) {
            State.profile = p2;
            State.bdsId   = p2.bds_id;
            D.sidebarName.textContent = p2.full_name || 'Ambassadeur';
            D.sidebarBds.textContent  = 'BDS';
        }
        return;
    }

    State.profile = data;
    State.bdsId   = data.bds_id;

    D.sidebarName.textContent = data.full_name || 'Ambassadeur';
    D.sidebarBds.textContent  = data.bds?.name || 'BDS';
    if (D.sidebarAvt) {
        D.sidebarAvt.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'A')}&background=5e227f&color=fff&bold=true`;
    }
    // Stocker le bds_id pour les autres pages
    if (data.bds_id) localStorage.setItem('my_bds_id', data.bds_id);
}

// ── 8. NAVIGATION ────────────────────────────────────────────
function goTo(view) {
    State.currentView = view;

    D.navItems.forEach(item => {
        const active = item.getAttribute('data-view') === view;
        item.classList.toggle('bg-laurette-50',    active);
        item.classList.toggle('text-laurette-700', active);
        item.classList.toggle('text-gray-600',    !active);
        item.classList.toggle('hover:bg-gray-50', !active);
        if (D.headerTitle && active) D.headerTitle.textContent = item.textContent.trim();
    });

    D.sections.forEach(s => {
        s.id === `content-${view}`
            ? s.classList.remove('hidden')
            : s.classList.add('hidden');
    });

    if (view === 'dashboard')     loadDashboard();
    if (view === 'events')        loadEvents();
    if (view === 'registrations') loadRegistrations();
    if (view === 'leaderboard')   loadLeaderboard();
    if (view === 'faq')           loadFAQ();
}

// ── 9. DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
    if (!State.bdsId || !_db) return;

    // Inscriptions validées
    const { count: regCount } = await _db
        .from('registrations').select('*', { count: 'exact', head: true })
        .eq('bds_id', State.bdsId).eq('status', 'validated');

    const count = regCount ?? 0;
    const pct   = Math.min(Math.round((count / ANNUAL_GOAL) * 100), 100);
    if (D.dashReg)      D.dashReg.textContent      = count;
    if (D.dashProgress) D.dashProgress.style.width = pct + '%';
    if (D.dashProgTxt)  D.dashProgTxt.textContent  = `${pct}% de l'objectif (${ANNUAL_GOAL})`;

    // Badge inscriptions
    if (D.regBadge) {
        D.regBadge.textContent = count;
        D.regBadge.classList.toggle('hidden', count === 0);
    }

    // Événements actifs
    const { count: evtCount } = await _db
        .from('events').select('*', { count: 'exact', head: true })
        .eq('bds_id', State.bdsId).in('status', ['planned', 'confirmed']);
    if (D.dashEvents) D.dashEvents.textContent = evtCount ?? 0;

    // Classement
    await loadRank(count);

    // Prochains événements
    const { data: upcoming } = await _db
        .from('events').select('title, event_date, type, actual_registrations, expected_registrations')
        .eq('bds_id', State.bdsId).in('status', ['planned', 'confirmed'])
        .order('event_date', { ascending: true }).limit(5);

    if (D.dashUpcoming) {
        if (upcoming && upcoming.length) {
            D.dashUpcoming.innerHTML = upcoming.map(ev => {
                const d = new Date(ev.event_date);
                return `<div class="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition">
                    <div class="h-10 w-10 bg-laurette-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-laurette-100">
                        <span class="text-xs font-black text-laurette-700 leading-none">${d.getDate()}</span>
                        <span class="text-[9px] font-bold text-laurette-400 uppercase leading-none mt-0.5">${d.toLocaleString('fr-FR',{month:'short'})}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-gray-900 truncate">${ev.title}</p>
                        <p class="text-xs text-gray-500 capitalize">${ev.type}</p>
                    </div>
                    <p class="text-xs font-bold text-gray-500 flex-shrink-0">${ev.actual_registrations ?? 0}/${ev.expected_registrations}</p>
                </div>`;
            }).join('');
        } else {
            D.dashUpcoming.innerHTML = `<div class="p-8 text-center text-sm text-gray-400">Aucun événement planifié.</div>`;
        }
    }

    // Sparkline
    drawSparkline();
}

async function loadRank(myCount) {
    const { data } = await _db.from('registrations').select('bds_id').eq('status', 'validated');
    if (!data) return;
    const counts = {};
    data.forEach(r => { counts[r.bds_id] = (counts[r.bds_id] || 0) + 1; });
    counts[State.bdsId] = myCount;
    const sorted = Object.values(counts).sort((a, b) => b - a);
    const rank   = sorted.indexOf(myCount) + 1;
    if (D.dashRank)     D.dashRank.textContent     = `#${rank}`;
    if (D.dashRankHint) D.dashRankHint.textContent = `Sur ${Object.keys(counts).length} BDS`;
}

function drawSparkline() {
    if (!D.dashChart) return;
    const vals = Array.from({ length: 30 }, (_, i) =>
        Math.max(0, Math.round(Math.random() * 4 + Math.sin(i / 5) * 2)));
    const max  = Math.max(...vals, 1);
    const w    = 100 / vals.length;
    let pathL  = '', pathA = '';
    vals.forEach((v, i) => {
        const x = i * w + w / 2;
        const y = 38 - (v / max) * 34;
        pathL += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
        pathA += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    });
    pathA += `L ${(vals.length - 1) * w + w / 2} 40 L ${w / 2} 40 Z`;
    D.dashChart.innerHTML = `
    <svg class="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8a4cae" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#8a4cae" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${pathA}" fill="url(#g)"/>
        <path d="${pathL}" fill="none" stroke="#8a4cae" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// ── 10. ÉVÉNEMENTS ───────────────────────────────────────────
async function loadEvents(updateState = true) {
    if (!State.bdsId || !_db || !D.eventsBody) return;

    D.eventsBody.innerHTML = loadingRow(5);

    const { data, error } = await _db
        .from('events').select('*')
        .eq('bds_id', State.bdsId)
        .order('event_date', { ascending: false });

    if (error) { console.error('[loadEvents]', error); }
    if (updateState && data) State.events = data;

    if (!data || !data.length) {
        D.eventsBody.innerHTML = `<tr><td colspan="5">${empty('Aucun événement', 'Créez votre premier événement.')}</td></tr>`;
        return;
    }

    const badges = {
        planned:   'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-600',
    };
    const labels = { planned:'Planifié', confirmed:'Confirmé', completed:'Terminé', cancelled:'Annulé' };

    D.eventsBody.innerHTML = data.map(ev => {
        const d   = new Date(ev.event_date);
        const pct = ev.expected_registrations > 0
            ? Math.min(Math.round(((ev.actual_registrations ?? 0) / ev.expected_registrations) * 100), 100) : 0;
        return `<tr class="hover:bg-gray-50/80 transition">
            <td class="px-5 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 bg-laurette-50 rounded-xl flex flex-col items-center justify-center border border-laurette-100 flex-shrink-0">
                        <span class="text-xs font-black text-laurette-700 leading-none">${d.getDate()}</span>
                        <span class="text-[9px] font-bold text-laurette-400 uppercase">${d.toLocaleString('fr-FR',{month:'short'})}</span>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-gray-900">${ev.title}</p>
                        <p class="text-[10px] text-gray-400">${d.toLocaleDateString('fr-FR',{weekday:'long'})}</p>
                    </div>
                </div>
            </td>
            <td class="px-5 py-4"><span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-md capitalize">${ev.type}</span></td>
            <td class="px-5 py-4"><span class="badge ${badges[ev.status] || badges.planned}">${labels[ev.status] || 'Planifié'}</span></td>
            <td class="px-5 py-4 min-w-[120px]">
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${pct >= 100 ? 'bg-flavy-400' : 'bg-laurette-500'}" style="width:${pct}%"></div>
                    </div>
                    <span class="text-[10px] font-bold text-gray-400">${pct}%</span>
                </div>
            </td>
            <td class="px-5 py-4 text-right text-sm font-bold text-gray-900">${ev.actual_registrations ?? 0} <span class="text-gray-400 font-normal">/ ${ev.expected_registrations}</span></td>
        </tr>`;
    }).join('');
}

// ── 11. INSCRIPTIONS ─────────────────────────────────────────
async function loadRegistrations() {
    if (!State.bdsId || !_db || !D.regBody) return;

    D.regBody.innerHTML = loadingRow(5);

    const { data, error } = await _db
        .from('registrations')
        .select('*, events(title)')
        .eq('bds_id', State.bdsId)
        .order('created_at', { ascending: false });

    if (error) { console.error('[loadRegistrations]', error); }

    State.registrations = data || [];
    renderRegistrations();
}

function renderRegistrations() {
    const q  = (D.regSearch?.value || '').toLowerCase();
    const st = D.regFilter?.value || '';

    const rows = State.registrations.filter(r => {
        const name = `${r.first_name} ${r.last_name}`.toLowerCase();
        return (!q || name.includes(q) || (r.email||'').toLowerCase().includes(q))
            && (!st || r.status === st);
    });

    if (D.regLabel) D.regLabel.textContent = `${rows.length} inscription${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
        D.regBody.innerHTML = `<tr><td colspan="5">${empty('Aucune inscription', q ? 'Essayez un autre terme.' : 'Les inscriptions apparaîtront ici.')}</td></tr>`;
        return;
    }

    const statusBadge = {
        validated: 'bg-green-100 text-green-700',
        pending:   'bg-yellow-100 text-yellow-700',
        rejected:  'bg-red-100 text-red-600',
    };
    const statusLabel = { validated:'Validé', pending:'En attente', rejected:'Rejeté' };

    D.regBody.innerHTML = rows.map(r => {
        const init = `${(r.first_name||'?')[0]}${(r.last_name||'?')[0]}`.toUpperCase();
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—';
        return `<tr class="hover:bg-gray-50/80 transition">
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-laurette-100 flex items-center justify-center text-xs font-black text-laurette-700 flex-shrink-0">${init}</div>
                    <div>
                        <p class="text-sm font-bold text-gray-900">${r.first_name ?? ''} ${r.last_name ?? ''}</p>
                        ${r.phone ? `<p class="text-[10px] text-gray-400">${r.phone}</p>` : ''}
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5 text-sm text-gray-600">${r.email ?? '—'}</td>
            <td class="px-5 py-3.5 text-sm text-gray-500 max-w-[150px] truncate">${r.events?.title ?? '—'}</td>
            <td class="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">${date}</td>
            <td class="px-5 py-3.5"><span class="badge ${statusBadge[r.status] || statusBadge.pending}">${statusLabel[r.status] || 'En attente'}</span></td>
        </tr>`;
    }).join('');
}

// ── 12. CLASSEMENT ───────────────────────────────────────────
async function loadLeaderboard() {
    if (!_db) return;

    const { data } = await _db
        .from('registrations').select('bds_id, bds(name, city)').eq('status', 'validated');

    if (!data) return;

    const map = {};
    data.forEach(r => {
        if (!r.bds_id) return;
        if (!map[r.bds_id]) map[r.bds_id] = { id: r.bds_id, name: r.bds?.name || 'BDS', city: r.bds?.city || '—', count: 0 };
        map[r.bds_id].count++;
    });

    const sorted = Object.values(map).sort((a, b) => b.count - a.count);
    if (D.lbCount) D.lbCount.textContent = `${sorted.length} établissement${sorted.length > 1 ? 's' : ''} actif${sorted.length > 1 ? 's' : ''}`;

    // Podium
    if (D.lbPodium) renderPodium(sorted);

    // Table
    if (!D.lbBody) return;
    const max = sorted[0]?.count || 1;
    const rankColors = ['text-yellow-500','text-gray-400','text-amber-600'];
    D.lbBody.innerHTML = sorted.map((b, i) => {
        const pct  = Math.round((b.count / max) * 100);
        const isMe = b.id === State.bdsId;
        return `<tr class="${isMe ? 'bg-laurette-50/60 border-l-4 border-l-laurette-700' : 'hover:bg-gray-50/70 transition'}">
            <td class="px-5 py-3.5 text-center font-black text-base ${rankColors[i] || 'text-gray-400'}">${i + 1}</td>
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-full bg-laurette-100 text-laurette-700 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                        ${b.name.replace('BDS ','').slice(0,2).toUpperCase()}
                    </div>
                    <span class="font-bold text-gray-900 text-sm">${b.name}</span>
                    ${isMe ? '<span class="text-[9px] font-black bg-laurette-700 text-white px-1.5 py-0.5 rounded">Vous</span>' : ''}
                </div>
            </td>
            <td class="px-5 py-3.5 text-sm text-gray-500">${b.city}</td>
            <td class="px-5 py-3.5 min-w-[120px]">
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-laurette-500 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5 text-right font-black text-base ${isMe ? 'text-laurette-700' : 'text-gray-900'}">${b.count}</td>
        </tr>`;
    }).join('');
}

function renderPodium(sorted) {
    const top   = [sorted[0], sorted[1], sorted[2]];
    const order = [top[1], top[0], top[2]]; // affichage : 2, 1, 3
    const conf  = [
        { border:'border-gray-300',  bg:'bg-gray-400',  h:'h-28', rank:2 },
        { border:'border-yellow-400',bg:'bg-yellow-400',h:'h-36', rank:1, crown:true },
        { border:'border-amber-500', bg:'bg-amber-500', h:'h-24', rank:3 },
    ];
    D.lbPodium.innerHTML = `<div class="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-8 items-end text-center">
        ${order.map((b, i) => {
            if (!b) return `<div class="flex flex-col items-center gap-2 opacity-20">
                <div class="w-12 h-12 rounded-full border-2 border-dashed border-gray-300"></div>
                <div class="bg-white border-t-4 ${conf[i].border} rounded-t-xl w-full ${conf[i].h}"></div>
            </div>`;
            const isMe = b.id === State.bdsId;
            const init = b.name.replace('BDS ','').slice(0,2).toUpperCase();
            return `<div class="flex flex-col items-center gap-2">
                <div class="relative">
                    ${conf[i].crown ? '<div class="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">👑</div>' : ''}
                    <div class="w-12 h-12 rounded-full border-4 ${conf[i].border} shadow-md flex items-center justify-center font-black text-sm ${isMe ? 'bg-laurette-700 text-white' : 'bg-white text-laurette-700'}">
                        ${init}
                    </div>
                    <span class="absolute -bottom-1 -right-1 ${conf[i].bg} text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">${conf[i].rank}</span>
                </div>
                <div class="bg-white border-t-4 ${conf[i].border} rounded-t-xl shadow-sm w-full ${conf[i].h} p-3 flex flex-col justify-between">
                    <p class="text-[10px] font-bold text-gray-800 truncate">${b.name.replace('BDS ','')}</p>
                    <div>
                        <span class="text-lg font-black text-gray-900">${b.count}</span>
                        <span class="block text-[9px] text-gray-400 uppercase font-bold">Inscrits</span>
                    </div>
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

// ── 13. FAQ ──────────────────────────────────────────────────
async function loadFAQ() {
    if (!_db || !D.faqBox) return;

    if (State.faqs.length > 0) { renderFAQ(); return; }

    const { data, error } = await _db
        .from('faq_items').select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

    if (error) { console.error('[loadFAQ]', error); }

    State.faqs = data || [];
    renderFAQ();
}

function renderFAQ() {
    if (!D.faqBox) return;
    if (!State.faqs.length) {
        D.faqBox.innerHTML = `<div class="text-center py-12 text-gray-400 text-sm">Aucun article disponible.</div>`;
        return;
    }
    D.faqBox.innerHTML = State.faqs.map((f, i) => `
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button class="w-full px-5 py-4 flex justify-between items-center text-left faq-btn" data-i="${i}">
                <span class="font-bold text-gray-900 text-sm pr-4">${f.question}</span>
                <svg class="h-4 w-4 text-gray-400 faq-icon flex-shrink-0 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="faq-body hidden px-5 pb-5 pt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-50 bg-gray-50/30">${f.answer}</div>
        </div>`).join('');

    D.faqBox.querySelectorAll('.faq-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const body = btn.nextElementSibling;
            const icon = btn.querySelector('.faq-icon');
            const open = !body.classList.contains('hidden');
            D.faqBox.querySelectorAll('.faq-body').forEach(b => b.classList.add('hidden'));
            D.faqBox.querySelectorAll('.faq-icon').forEach(ic => ic.classList.remove('rotate-180'));
            if (!open) { body.classList.remove('hidden'); icon.classList.add('rotate-180'); }
        });
    });
}

// ── 14. MODALS ───────────────────────────────────────────────
function openModal(modal) { modal?.classList.remove('hidden'); }
function closeModal(modal, form) { modal?.classList.add('hidden'); form?.reset(); }

// Modal événement
function openEventModal()      { openModal(D.modalEvent); }
function closeEventModal()     { closeModal(D.modalEvent, D.formEvent); }
function openRegModal()        { populateEventSelect(); openModal(D.modalReg); }
function closeRegModal()       { closeModal(D.modalReg, D.formReg); }

async function populateEventSelect() {
    const sel = el('reg-event-id');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Aucun événement —</option>';
    if (!State.events.length) await loadEvents(true);
    State.events.forEach(ev => {
        const o = document.createElement('option');
        o.value       = ev.id;
        o.textContent = `${ev.title} (${new Date(ev.event_date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})})`;
        sel.appendChild(o);
    });
}

// ── 15. ÉCOUTEURS ────────────────────────────────────────────
function setupListeners() {

    // Toggle password
    D.togglePwd?.addEventListener('click', () => {
        const p = el('password');
        if (p) p.type = p.type === 'password' ? 'text' : 'password';
    });

    // Navigation
    D.navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const v = item.getAttribute('data-view');
            if (v) goTo(v);
        });
    });

    // Liens internes qui déclenchent la nav
    document.querySelectorAll('.nav-trigger-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const v = link.getAttribute('data-view');
            if (v) goTo(v);
        });
    });

    // Déconnexion
    D.logoutBtn?.addEventListener('click', () => _db?.auth.signOut());

    // Bouton + global
    D.btnAdd?.addEventListener('click', openRegModal);

    // Modal événement
    D.btnCreate?.addEventListener('click', openEventModal);
    el('btn-cancel-event')?.addEventListener('click', closeEventModal);
    el('btn-cancel-event-2')?.addEventListener('click', closeEventModal);
    D.evtBackdrop?.addEventListener('click', closeEventModal);

    D.formEvent?.addEventListener('submit', async e => {
        e.preventDefault();
        if (!State.bdsId || !_db) return;
        const btn = D.formEvent.querySelector('button[type=submit]');
        if (btn) { btn.disabled = true; btn.textContent = 'Création…'; }

        const { error } = await _db.from('events').insert([{
            title:                  el('event-title')?.value,
            event_date:             el('event-date')?.value,
            type:                   el('event-type')?.value,
            expected_registrations: parseInt(el('event-target')?.value) || 0,
            bds_id:     State.bdsId,
            created_by: State.user.id,
            status:     'planned',
        }]);

        if (btn) { btn.disabled = false; btn.textContent = "Créer l'événement"; }
        if (!error) {
            closeEventModal();
            toast('Événement créé !', 'success');
            loadEvents();
            loadDashboard();
        } else {
            toast('Erreur : ' + error.message, 'error');
        }
    });

    // Modal inscription
    el('btn-cancel-reg')?.addEventListener('click', closeRegModal);
    el('btn-cancel-reg-2')?.addEventListener('click', closeRegModal);
    D.regBackdrop?.addEventListener('click', closeRegModal);

    D.formReg?.addEventListener('submit', async e => {
        e.preventDefault();
        if (!State.bdsId || !_db) return;
        const btn = D.formReg.querySelector('button[type=submit]');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }

        const payload = {
            first_name:   el('reg-first-name')?.value.trim(),
            last_name:    el('reg-last-name')?.value.trim(),
            email:        el('reg-email')?.value.trim(),
            phone:        el('reg-phone')?.value.trim() || null,
            bds_id:       State.bdsId,
            ambassador_id: State.user.id,
            event_id:     el('reg-event-id')?.value || null,
            status:       'validated',
        };

        const { error } = await _db.from('registrations').insert([payload]);

        if (btn) { btn.disabled = false; btn.innerHTML = '✓ Inscrire le donneur'; }
        if (!error) {
            closeRegModal();
            toast(`${payload.first_name} ${payload.last_name} inscrit(e) !`, 'success');
            loadDashboard();
            if (State.currentView === 'registrations') loadRegistrations();
        } else {
            toast('Erreur : ' + error.message, 'error');
        }
    });

    // Search & filter inscriptions
    D.regSearch?.addEventListener('input', debounce(renderRegistrations, 300));
    D.regFilter?.addEventListener('change', renderRegistrations);

    // Export CSV
    D.regExport?.addEventListener('click', exportCSV);
}

// ── 16. UTILITAIRES ──────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function loadingRow(cols) {
    return `<tr><td colspan="${cols}" class="px-5 py-10 text-center">
        <div class="flex flex-col items-center gap-2">
            <div class="w-7 h-7 border-2 border-laurette-200 border-t-laurette-700 rounded-full animate-spin"></div>
            <p class="text-sm text-gray-400">Chargement…</p>
        </div>
    </td></tr>`;
}

function empty(title, sub = '') {
    return `<div class="py-10 flex flex-col items-center gap-2 text-center">
        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1">
            <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <p class="text-sm font-bold text-gray-500">${title}</p>
        ${sub ? `<p class="text-xs text-gray-400">${sub}</p>` : ''}
    </div>`;
}

function exportCSV() {
    if (!State.registrations.length) { toast('Aucune donnée à exporter.', 'warning'); return; }
    const rows = [
        ['Prénom','Nom','Email','Téléphone','Statut','Date'],
        ...State.registrations.map(r => [
            r.first_name, r.last_name, r.email, r.phone || '',
            r.status,
            r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '',
        ].map(v => `"${v ?? ''}"`)
        )
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([rows], { type:'text/csv' }));
    a.download = `inscriptions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('Export CSV généré !', 'success');
}

// ── 17. DÉMARRAGE ────────────────────────────────────────────
setupListeners();
initAuth();
