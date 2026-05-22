/**
 * ============================================================
 * LAURETTE FUGAIN × BDS — Moteur JavaScript v2.0
 * ============================================================
 */

// ==========================================
// 1. SUPABASE & ÉTAT GLOBAL
// ==========================================
const SUPABASE_URL  = 'https://lhelfggczeybornhemsf.supabase.co';
const SUPABASE_KEY  = 'sb_secret_tY-Z33hN9u-irzrluJAgsA_V2eZOj-d';

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch(e) {
    console.error('Supabase init failed:', e);
}

const State = {
    user: null,
    profile: null,
    currentView: 'dashboard',
    events: [],
    faqs: [],
    registrations: [],
    leaderboard: [],
    // Objectif annuel (modifiable)
    annualGoal: 100,
};

// ==========================================
// 2. CACHE DOM
// ==========================================
const DOM = {
    views: {
        auth: document.getElementById('view-auth'),
        app:  document.getElementById('app-shell'),
    },
    sections:    document.querySelectorAll('.view-section'),
    navItems:    document.querySelectorAll('.nav-item'),
    navTriggers: document.querySelectorAll('.nav-trigger-link'),
    headerTitle: document.getElementById('header-title'),
    auth: {
        form:           document.getElementById('auth-form'),
        email:          document.getElementById('email'),
        password:       document.getElementById('password'),
        errorContainer: document.getElementById('auth-error-message'),
        errorText:      document.getElementById('auth-error-text'),
        submitBtn:      document.getElementById('auth-submit-btn'),
        togglePassword: document.getElementById('toggle-password'),
    },
    sidebar: {
        userName:  document.getElementById('sidebar-user-name'),
        bdsName:   document.getElementById('sidebar-bds-name'),
        avatar:    document.getElementById('sidebar-avatar'),
        logoutBtn: document.getElementById('btn-logout'),
    },
    dashboard: {
        regCount:         document.getElementById('dash-reg-count'),
        regProgress:      document.getElementById('dash-reg-progress'),
        regProgressText:  document.getElementById('dash-reg-progress-text'),
        eventCount:       document.getElementById('dash-event-count'),
        rank:             document.getElementById('dash-rank'),
        rankHint:         document.getElementById('dash-rank-hint'),
        recentEvents:     document.getElementById('dash-recent-events'),
        chartContainer:   document.getElementById('dash-chart-container'),
    },
    events: {
        tableBody: document.getElementById('events-table-body'),
        btnCreate: document.getElementById('btn-create-event'),
    },
    registrations: {
        tableBody:    document.getElementById('registrations-table-body'),
        search:       document.getElementById('reg-search'),
        filterStatus: document.getElementById('reg-filter-status'),
        exportBtn:    document.getElementById('btn-export-reg'),
        countLabel:   document.getElementById('reg-count-label'),
        badge:        document.getElementById('badge-registrations'),
    },
    leaderboard: {
        podium:    document.getElementById('leaderboard-podium'),
        tableBody: document.getElementById('leaderboard-table-body'),
        count:     document.getElementById('leaderboard-count'),
    },
    faq: {
        container: document.getElementById('faq-accordion-container'),
    },
    modal: {
        event: {
            container: document.getElementById('modal-event'),
            backdrop:  document.getElementById('modal-event-backdrop'),
            form:      document.getElementById('form-create-event'),
            btnCancel: document.getElementById('btn-cancel-event'),
            btnCancel2: document.getElementById('btn-cancel-event-2'),
            btnSubmit: document.getElementById('btn-submit-event'),
        },
        reg: {
            container:   document.getElementById('modal-registration'),
            backdrop:    document.getElementById('modal-reg-backdrop'),
            form:        document.getElementById('form-registration'),
            btnCancel:   document.getElementById('btn-cancel-reg'),
            btnCancel2:  document.getElementById('btn-cancel-reg-2'),
            eventSelect: document.getElementById('reg-event-id'),
        },
    },
    toastContainer: document.getElementById('toast-container'),
    btnGlobalAdd:   document.getElementById('btn-global-add'),
};

// ==========================================
// 3. SYSTÈME DE TOASTS
// ==========================================
const Toast = {
    show(message, type = 'success', duration = 4000) {
        const colors = {
            success: 'bg-gray-900 text-white',
            error:   'bg-red-600 text-white',
            warning: 'bg-amber-500 text-white',
            info:    'bg-laurette-700 text-white',
        };
        const icons = {
            success: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`,
            error:   `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
            warning: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path></svg>`,
            info:    `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
        };
        const el = document.createElement('div');
        el.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-floating text-sm font-semibold toast-enter ${colors[type] || colors.success}`;
        el.innerHTML = `${icons[type] || icons.success}<span>${message}</span>`;
        DOM.toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.add('toast-exit');
            el.addEventListener('animationend', () => el.remove());
        }, duration);
    }
};

// ==========================================
// 4. ÉCOUTEURS D'ÉVÉNEMENTS
// ==========================================
function setupEventListeners() {

    // --- Auth form ---
    if (DOM.auth.form) {
        DOM.auth.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = DOM.auth.submitBtn;
            btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Connexion…`;
            btn.disabled = true;
            DOM.auth.errorContainer.classList.add('hidden');

            if (!supabase) { Toast.show('Serveur inaccessible.', 'error'); btn.innerHTML = 'Accéder à mon espace'; btn.disabled = false; return; }
            const { error } = await supabase.auth.signInWithPassword({
                email:    DOM.auth.email.value.trim(),
                password: DOM.auth.password.value,
            });

            if (error) {
                DOM.auth.errorText.textContent = error.message === 'Invalid login credentials'
                    ? 'Identifiants incorrects. Vérifie ton email et ton mot de passe.'
                    : error.message;
                DOM.auth.errorContainer.classList.remove('hidden');
                btn.innerHTML = 'Accéder à mon espace';
                btn.disabled = false;
            }
        });
    }

    // --- Toggle password visibility ---
    if (DOM.auth.togglePassword) {
        DOM.auth.togglePassword.addEventListener('click', () => {
            const input = DOM.auth.password;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    }

    // --- Navigation sidebar ---
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) navigateTo(view);
        });
    });

    // --- Links inside content that trigger nav ---
    DOM.navTriggers.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            if (view) navigateTo(view);
        });
    });

    // --- Logout ---
    if (DOM.sidebar.logoutBtn) {
        DOM.sidebar.logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });
    }

    // --- Global add button → registration modal ---
    if (DOM.btnGlobalAdd) {
        DOM.btnGlobalAdd.addEventListener('click', openRegistrationModal);
    }

    // --- Event modal ---
    const em = DOM.modal.event;
    if (em.btnCancel)  em.btnCancel.addEventListener('click', closeEventModal);
    if (em.btnCancel2) em.btnCancel2.addEventListener('click', closeEventModal);
    if (em.backdrop)   em.backdrop.addEventListener('click', closeEventModal);
    if (DOM.events.btnCreate) DOM.events.btnCreate.addEventListener('click', () => em.container.classList.remove('hidden'));

    if (em.form) {
        em.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!State.profile?.bds_id) return;
            em.btnSubmit.disabled = true;
            em.btnSubmit.innerHTML = `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Création…`;

            const { error } = await supabase.from('events').insert([{
                title:                  document.getElementById('event-title').value,
                event_date:             document.getElementById('event-date').value,
                type:                   document.getElementById('event-type').value,
                expected_registrations: parseInt(document.getElementById('event-target').value) || 0,
                bds_id:                 State.profile.bds_id,
                created_by:             State.user.id,
                status:                 'planned',
            }]);

            em.btnSubmit.disabled = false;
            em.btnSubmit.innerHTML = 'Créer l\'événement';

            if (!error) {
                closeEventModal();
                Toast.show('Événement créé avec succès !', 'success');
                loadEventsData();
                loadDashboardData();
            } else {
                Toast.show('Erreur : ' + error.message, 'error');
            }
        });
    }

    // --- Registration modal ---
    const rm = DOM.modal.reg;
    if (rm.btnCancel)  rm.btnCancel.addEventListener('click', closeRegistrationModal);
    if (rm.btnCancel2) rm.btnCancel2.addEventListener('click', closeRegistrationModal);
    if (rm.backdrop)   rm.backdrop.addEventListener('click', closeRegistrationModal);

    if (rm.form) {
        rm.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!State.profile?.bds_id) return;

            const btn = document.getElementById('btn-submit-reg');
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Enregistrement…`;

            const eventId = document.getElementById('reg-event-id').value;
            const payload = {
                first_name: document.getElementById('reg-first-name').value.trim(),
                last_name:  document.getElementById('reg-last-name').value.trim(),
                email:      document.getElementById('reg-email').value.trim(),
                phone:      document.getElementById('reg-phone').value.trim() || null,
                bds_id:     State.profile.bds_id,
                status:     'validated',
                event_id:   eventId || null,
            };

            const { error } = await supabase.from('registrations').insert([payload]);

            btn.disabled = false;
            btn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Inscrire le donneur`;

            if (!error) {
                closeRegistrationModal();
                Toast.show(`${payload.first_name} ${payload.last_name} inscrit(e) avec succès ! 🎉`, 'success');
                loadDashboardData();
                if (State.currentView === 'registrations') loadRegistrationsData();
            } else {
                Toast.show('Erreur : ' + error.message, 'error');
            }
        });
    }

    // --- Registrations — search + filter ---
    if (DOM.registrations.search) {
        DOM.registrations.search.addEventListener('input', debounce(() => renderRegistrationsTable(), 300));
    }
    if (DOM.registrations.filterStatus) {
        DOM.registrations.filterStatus.addEventListener('change', () => renderRegistrationsTable());
    }

    // --- Registrations — export CSV ---
    if (DOM.registrations.exportBtn) {
        DOM.registrations.exportBtn.addEventListener('click', exportRegistrationsCSV);
    }
}

// ==========================================
// 5. HELPERS
// ==========================================
function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function closeEventModal() {
    DOM.modal.event.container.classList.add('hidden');
    DOM.modal.event.form.reset();
}

async function openRegistrationModal() {
    // Populate event selector
    const select = DOM.modal.reg.eventSelect;
    select.innerHTML = '<option value="">— Aucun événement —</option>';
    if (State.events.length === 0) await loadEventsData(false);
    State.events.forEach(ev => {
        const opt = document.createElement('option');
        opt.value = ev.id;
        opt.textContent = `${ev.title} (${new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`;
        select.appendChild(opt);
    });
    DOM.modal.reg.form.reset();
    DOM.modal.reg.container.classList.remove('hidden');
}

function closeRegistrationModal() {
    DOM.modal.reg.container.classList.add('hidden');
    DOM.modal.reg.form.reset();
}

// ==========================================
// 6. GESTION DES SESSIONS
// ==========================================
async function checkActiveSession() {
    // Si Supabase n'est pas initialisé, on affiche juste l'auth
    if (!supabase) {
        DOM.auth.errorText.textContent = 'Erreur : impossible de contacter le serveur.';
        DOM.auth.errorContainer.classList.remove('hidden');
        return; // view-auth est déjà visible par défaut
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
            await onSignIn(session.user);
        }
        // Si pas de session : view-auth est déjà visible, rien à faire
    } catch (err) {
        console.error('Erreur init Supabase:', err);
        DOM.auth.errorText.textContent = 'Erreur réseau. Vérifie ta connexion internet.';
        DOM.auth.errorContainer.classList.remove('hidden');
        // view-auth est déjà visible, rien à faire
    }

    if (!supabase) return;
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await onSignIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });
}

async function onSignIn(user) {
    State.user = user;
    DOM.views.auth.classList.add('hidden');
    DOM.views.app.classList.remove('hidden');
    await loadUserProfile();
    navigateTo('dashboard');
}

function showAuthScreen() {
    State.user    = null;
    State.profile = null;
    DOM.views.app.classList.add('hidden');
    DOM.views.auth.classList.remove('hidden');
    if (DOM.auth.submitBtn) {
        DOM.auth.submitBtn.innerHTML = 'Accéder à mon espace';
        DOM.auth.submitBtn.disabled  = false;
    }
}

// ==========================================
// 7. ROUTAGE
// ==========================================
function navigateTo(viewName) {
    State.currentView = viewName;

    DOM.navItems.forEach(item => {
        const isActive = item.getAttribute('data-view') === viewName;
        item.classList.toggle('bg-laurette-50',    isActive);
        item.classList.toggle('text-laurette-700', isActive);
        item.classList.toggle('text-gray-600',     !isActive);
        item.classList.toggle('hover:bg-gray-50',  !isActive);
        item.classList.toggle('hover:text-gray-900', !isActive);
        const svg = item.querySelector('svg');
        if (svg) {
            svg.classList.toggle('text-laurette-700', isActive);
            svg.classList.toggle('text-gray-400',     !isActive);
        }
        if (isActive) DOM.headerTitle.textContent = item.textContent.trim();
    });

    DOM.sections.forEach(section => {
        section.id === `content-${viewName}`
            ? section.classList.remove('hidden')
            : section.classList.add('hidden');
    });

    if (viewName === 'dashboard')     loadDashboardData();
    if (viewName === 'events')        loadEventsData();
    if (viewName === 'registrations') loadRegistrationsData();
    if (viewName === 'leaderboard')   loadLeaderboardData();
    if (viewName === 'faq')           loadFAQData();
}

// ==========================================
// 8. CHARGEMENT DES DONNÉES
// ==========================================
async function loadUserProfile() {
    if (!State.user) return;
    const { data, error } = await supabase
        .from('profiles')
        .select(`*, bds (name, city)`)
        .eq('id', State.user.id)
        .single();

    if (!error && data) {
        State.profile = data;
        DOM.sidebar.userName.textContent = data.full_name || 'Ambassadeur';
        DOM.sidebar.bdsName.textContent  = data.bds?.name || 'BDS';
        DOM.sidebar.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'A')}&background=5e227f&color=fff&bold=true`;
    }
}

// --- Dashboard ---
async function loadDashboardData() {
    if (!State.profile?.bds_id) return;

    const bdsId = State.profile.bds_id;

    // Events count
    const { count: eventsCount } = await supabase.from('events')
        .select('*', { count: 'exact', head: true })
        .eq('bds_id', bdsId)
        .in('status', ['planned', 'confirmed']);
    DOM.dashboard.eventCount.textContent = eventsCount ?? 0;

    // Registrations count + progress
    const { count: regCount } = await supabase.from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('bds_id', bdsId)
        .eq('status', 'validated');
    const count  = regCount ?? 0;
    const pct    = Math.min(Math.round((count / State.annualGoal) * 100), 100);
    DOM.dashboard.regCount.textContent        = count;
    DOM.dashboard.regProgress.style.width     = pct + '%';
    DOM.dashboard.regProgressText.textContent = `${pct}% de l'objectif (${State.annualGoal})`;

    // Badge
    if (DOM.registrations.badge) {
        DOM.registrations.badge.textContent = count;
        DOM.registrations.badge.classList.toggle('hidden', count === 0);
    }

    // Rank from leaderboard
    await computeRank(bdsId, count);

    // Upcoming events
    const { data: recentEvents } = await supabase.from('events')
        .select('title, event_date, type, actual_registrations, expected_registrations')
        .eq('bds_id', bdsId)
        .in('status', ['planned', 'confirmed'])
        .order('event_date', { ascending: true })
        .limit(5);

    if (recentEvents && recentEvents.length > 0) {
        DOM.dashboard.recentEvents.innerHTML = recentEvents.map(ev => {
            const d = new Date(ev.event_date);
            return `
            <div class="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition">
                <div class="h-10 w-10 bg-laurette-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-laurette-100">
                    <span class="text-xs font-black text-laurette-700 leading-none">${d.getDate()}</span>
                    <span class="text-[9px] font-bold text-laurette-400 uppercase leading-none mt-0.5">${d.toLocaleString('fr-FR',{month:'short'})}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-gray-900 truncate">${ev.title}</p>
                    <p class="text-xs text-gray-500 capitalize">${ev.type}</p>
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="text-xs font-bold text-gray-700">${ev.actual_registrations ?? 0}<span class="text-gray-400 font-normal"> / ${ev.expected_registrations}</span></p>
                </div>
            </div>`;
        }).join('');
    } else {
        DOM.dashboard.recentEvents.innerHTML = emptyState('Aucun événement planifié.', 'Créez votre premier événement.', 'events');
    }

    // Simple sparkline chart
    buildSparklineChart();
}

async function computeRank(bdsId, myCount) {
    // Get total for each BDS and determine rank
    const { data: allCounts } = await supabase
        .from('registrations')
        .select('bds_id')
        .eq('status', 'validated');

    if (!allCounts) return;

    const map = {};
    allCounts.forEach(r => { map[r.bds_id] = (map[r.bds_id] || 0) + 1; });
    map[bdsId] = myCount;

    const sorted = Object.values(map).sort((a, b) => b - a);
    const rank   = sorted.indexOf(myCount) + 1;
    const total  = Object.keys(map).length;

    DOM.dashboard.rank.textContent     = `#${rank}`;
    DOM.dashboard.rankHint.textContent = `Sur ${total} BDS en compétition`;
}

function buildSparklineChart() {
    // Generate realistic-looking mock data (replace with real data if table exists)
    const container = DOM.dashboard.chartContainer;
    const days  = 30;
    const values = Array.from({ length: days }, (_, i) => Math.max(0, Math.round(Math.random() * 5 + Math.sin(i / 4) * 3)));
    const max   = Math.max(...values, 1);
    const w     = 100 / days;

    container.innerHTML = `
    <svg class="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#8a4cae" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="#8a4cae" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <!-- Area fill -->
        <path d="${buildPath(values, max, true)}" fill="url(#grad)"/>
        <!-- Line -->
        <path d="${buildPath(values, max, false)}" fill="none" stroke="#8a4cae" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Dots on last point -->
        <circle cx="${(days - 1) * w + w / 2}" cy="${40 - (values[days-1] / max) * 36 - 2}" r="1.5" fill="#b4d429"/>
    </svg>
    <div class="absolute bottom-0 left-0 right-0 flex justify-between px-1">
        ${['J-30','','','','J-15','','','','Auj.'].map(l => `<span class="text-[8px] text-gray-300 font-semibold">${l}</span>`).join('')}
    </div>`;
}

function buildPath(values, max, close) {
    const days = values.length;
    const w    = 100 / days;
    let   d    = '';
    values.forEach((v, i) => {
        const x = i * w + w / 2;
        const y = 40 - (v / max) * 36 - 2;
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    if (close) {
        d += ` L ${(days - 1) * w + w / 2} 40 L ${w / 2} 40 Z`;
    }
    return d;
}

// --- Events ---
async function loadEventsData(updateState = true) {
    if (!State.profile?.bds_id) return;

    const { data, error } = await supabase.from('events')
        .select('*')
        .eq('bds_id', State.profile.bds_id)
        .order('event_date', { ascending: false });

    if (updateState && data) State.events = data;

    if (error || !data || data.length === 0) {
        DOM.events.tableBody.innerHTML = `<tr><td colspan="5" class="px-5 py-12 text-center">
            ${emptyState('Aucun événement enregistré.', 'Créez votre premier événement de sensibilisation.')}
        </td></tr>`;
        return;
    }

    const badges = {
        planned:   '<span class="badge bg-yellow-100 text-yellow-800">Planifié</span>',
        confirmed: '<span class="badge bg-blue-100 text-blue-800">Confirmé</span>',
        completed: '<span class="badge bg-green-100 text-green-800">Terminé</span>',
        cancelled: '<span class="badge bg-red-100 text-red-800">Annulé</span>',
    };

    DOM.events.tableBody.innerHTML = data.map(ev => {
        const d       = new Date(ev.event_date);
        const pct     = ev.expected_registrations > 0
            ? Math.min(Math.round(((ev.actual_registrations ?? 0) / ev.expected_registrations) * 100), 100)
            : 0;
        return `
        <tr class="hover:bg-gray-50/80 transition group">
            <td class="px-5 py-4 whitespace-nowrap flex items-center gap-3">
                <div class="h-10 w-10 bg-laurette-50 rounded-xl flex flex-col items-center justify-center border border-laurette-100 flex-shrink-0">
                    <span class="text-xs font-black text-laurette-700 leading-none">${d.getDate()}</span>
                    <span class="text-[9px] font-bold text-laurette-400 uppercase leading-none mt-0.5">${d.toLocaleString('fr-FR',{month:'short'})}</span>
                </div>
                <div>
                    <p class="text-sm font-bold text-gray-900">${ev.title}</p>
                    <p class="text-[10px] text-gray-400 font-semibold">${d.toLocaleDateString('fr-FR',{weekday:'long'})}</p>
                </div>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <span class="text-xs font-semibold text-gray-600 capitalize bg-gray-100 px-2 py-1 rounded-md">${ev.type}</span>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">${badges[ev.status] || badges.planned}</td>
            <td class="px-5 py-4 min-w-[120px]">
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${pct >= 100 ? 'bg-flavy-400' : 'bg-laurette-500'} transition-all" style="width:${pct}%"></div>
                    </div>
                    <span class="text-[10px] font-bold text-gray-500">${pct}%</span>
                </div>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                ${ev.actual_registrations ?? 0} <span class="text-gray-400 font-normal">/ ${ev.expected_registrations}</span>
            </td>
        </tr>`;
    }).join('');
}

// --- Registrations ---
async function loadRegistrationsData() {
    if (!State.profile?.bds_id) return;

    const { data, error } = await supabase.from('registrations')
        .select('*, events(title, event_date)')
        .eq('bds_id', State.profile.bds_id)
        .order('created_at', { ascending: false });

    if (error) {
        Toast.show('Erreur de chargement des inscriptions', 'error');
        return;
    }

    State.registrations = data || [];
    renderRegistrationsTable();
}

function renderRegistrationsTable() {
    const search       = (DOM.registrations.search?.value || '').toLowerCase().trim();
    const filterStatus = DOM.registrations.filterStatus?.value || '';

    let rows = State.registrations.filter(r => {
        const name   = `${r.first_name} ${r.last_name}`.toLowerCase();
        const email  = (r.email || '').toLowerCase();
        const matchQ = !search || name.includes(search) || email.includes(search);
        const matchS = !filterStatus || r.status === filterStatus;
        return matchQ && matchS;
    });

    if (DOM.registrations.countLabel) {
        DOM.registrations.countLabel.textContent = `${rows.length} inscription${rows.length !== 1 ? 's' : ''} affichée${rows.length !== 1 ? 's' : ''}`;
    }

    if (rows.length === 0) {
        DOM.registrations.tableBody.innerHTML = `<tr><td colspan="5" class="px-5 py-12 text-center">
            ${emptyState('Aucune inscription trouvée.', search ? 'Essayez un autre terme de recherche.' : 'Les inscriptions créées apparaîtront ici.')}
        </td></tr>`;
        return;
    }

    const badgeStatus = {
        validated: '<span class="badge bg-green-100 text-green-700">Validé</span>',
        pending:   '<span class="badge bg-yellow-100 text-yellow-700">En attente</span>',
        cancelled: '<span class="badge bg-red-100 text-red-600">Annulé</span>',
    };

    const initials = r =>
        `${(r.first_name || '?')[0]}${(r.last_name || '?')[0]}`.toUpperCase();

    DOM.registrations.tableBody.innerHTML = rows.map(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
        const event = r.events ? r.events.title : '—';
        return `
        <tr class="hover:bg-gray-50/80 transition">
            <td class="px-5 py-3.5 whitespace-nowrap flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-laurette-100 flex items-center justify-center flex-shrink-0">
                    <span class="text-xs font-black text-laurette-700">${initials(r)}</span>
                </div>
                <div>
                    <p class="text-sm font-bold text-gray-900">${r.first_name ?? ''} ${r.last_name ?? ''}</p>
                    ${r.phone ? `<p class="text-[10px] text-gray-400">${r.phone}</p>` : ''}
                </div>
            </td>
            <td class="px-5 py-3.5 text-sm text-gray-600">${r.email ?? '—'}</td>
            <td class="px-5 py-3.5 text-sm text-gray-500 max-w-[160px] truncate" title="${event}">${event}</td>
            <td class="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">${date}</td>
            <td class="px-5 py-3.5">${badgeStatus[r.status] || badgeStatus.pending}</td>
        </tr>`;
    }).join('');
}

function exportRegistrationsCSV() {
    const rows = State.registrations;
    if (!rows.length) { Toast.show('Aucune donnée à exporter.', 'warning'); return; }
    const headers = ['Prénom','Nom','Email','Téléphone','Statut','Date'];
    const csv = [
        headers.join(','),
        ...rows.map(r => [
            r.first_name, r.last_name, r.email, r.phone || '',
            r.status,
            r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '',
        ].map(v => `"${v ?? ''}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `inscriptions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Export CSV généré !', 'success');
}

// --- Leaderboard ---
async function loadLeaderboardData() {
    const { data: allRegs } = await supabase
        .from('registrations')
        .select('bds_id, bds(name, city)')
        .eq('status', 'validated');

    if (!allRegs) return;

    // Count per BDS
    const map = {};
    allRegs.forEach(r => {
        if (!r.bds_id) return;
        if (!map[r.bds_id]) map[r.bds_id] = { id: r.bds_id, name: r.bds?.name || 'BDS', city: r.bds?.city || '—', count: 0 };
        map[r.bds_id].count++;
    });

    const sorted   = Object.values(map).sort((a, b) => b.count - a.count);
    State.leaderboard = sorted;

    const myBdsId  = State.profile?.bds_id;
    const total    = sorted.length;

    // Count label
    if (DOM.leaderboard.count) DOM.leaderboard.count.textContent = `${total} Établissement${total !== 1 ? 's' : ''} actif${total !== 1 ? 's' : ''}`;

    // Podium (top 3)
    renderPodium(sorted, myBdsId);

    // Table
    if (sorted.length === 0) {
        DOM.leaderboard.tableBody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-gray-400">Aucune donnée disponible.</td></tr>`;
        return;
    }

    const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
    DOM.leaderboard.tableBody.innerHTML = sorted.map((bds, i) => {
        const rank   = i + 1;
        const isMe   = bds.id === myBdsId;
        const pct    = sorted[0].count > 0 ? Math.round((bds.count / sorted[0].count) * 100) : 0;
        return `
        <tr class="${isMe ? 'bg-laurette-50/60 border-l-4 border-l-laurette-700' : 'hover:bg-gray-50/80 transition'}">
            <td class="px-5 py-3.5 text-center font-black text-base ${rankColors[i] || 'text-gray-400'}">${rank}</td>
            <td class="px-5 py-3.5">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-laurette-100 flex items-center justify-center text-[9px] font-black text-laurette-700 flex-shrink-0">
                        ${bds.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span class="font-bold text-gray-900 text-sm">${bds.name}</span>
                    ${isMe ? '<span class="text-[9px] font-black bg-laurette-700 text-white px-1.5 py-0.5 rounded uppercase">Vous</span>' : ''}
                </div>
            </td>
            <td class="px-5 py-3.5 text-sm text-gray-500">${bds.city}</td>
            <td class="px-5 py-3.5 min-w-[100px]">
                <div class="flex items-center gap-2">
                    <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-laurette-500 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-3.5 text-right font-black text-base ${isMe ? 'text-laurette-700' : 'text-gray-900'}">${bds.count}</td>
        </tr>`;
    }).join('');
}

function renderPodium(sorted, myBdsId) {
    const top = sorted.slice(0, 3);
    while (top.length < 3) top.push(null);
    // Podium order: [2nd, 1st, 3rd]
    const order = [top[1], top[0], top[2]];
    const medals   = ['🥈', '🥇', '🥉'];
    const heights  = ['h-24', 'h-32', 'h-20'];
    const borders  = ['border-t-gray-400', 'border-t-yellow-400', 'border-t-amber-600'];
    const rankBg   = ['bg-gray-400', 'bg-yellow-400', 'bg-amber-600'];
    const rankNums = [2, 1, 3];

    DOM.leaderboard.podium.innerHTML = order.map((bds, i) => {
        if (!bds) return `<div class="flex flex-col items-center space-y-2 opacity-30">
            <div class="w-14 h-14 rounded-full border-2 border-dashed border-gray-300"></div>
            <div class="bg-white border-t-4 ${borders[i]} rounded-t-xl w-full ${heights[i]} flex items-center justify-center">
                <span class="text-xs text-gray-300">—</span>
            </div>
        </div>`;
        const isMe = bds.id === myBdsId;
        return `
        <div class="flex flex-col items-center space-y-2">
            <div class="relative">
                ${rankNums[i] === 1 ? '<div class="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 text-sm">👑</div>' : ''}
                <div class="w-12 h-12 rounded-full ${isMe ? 'bg-laurette-700' : 'bg-laurette-100'} flex items-center justify-center font-black ${isMe ? 'text-white' : 'text-laurette-700'} text-xs border-2 ${isMe ? 'border-laurette-500' : 'border-laurette-200'} shadow-md">
                    ${bds.name.slice(0, 2).toUpperCase()}
                </div>
                <span class="absolute -bottom-1 -right-1 ${rankBg[i]} text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">${rankNums[i]}</span>
            </div>
            <div class="bg-white border-t-4 ${borders[i]} rounded-t-xl shadow-sm w-full ${heights[i]} p-2 flex flex-col justify-between">
                <p class="text-[10px] font-bold text-gray-800 truncate text-center">${bds.name}</p>
                <div class="text-center">
                    <span class="text-lg font-black text-gray-900">${bds.count}</span>
                    <span class="block text-[9px] text-gray-400 uppercase font-bold">Dons</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

// --- FAQ ---
async function loadFAQData() {
    if (State.faqs.length === 0) {
        const { data } = await supabase.from('faq_items')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });
        if (data) State.faqs = data;
    }

    if (!State.faqs.length) {
        DOM.faq.container.innerHTML = `<div class="text-center py-12 text-gray-400">
            ${emptyState('Aucun article FAQ disponible.', 'Le contenu sera bientôt disponible.')}
        </div>`;
        return;
    }

    DOM.faq.container.innerHTML = State.faqs.map((faq, i) => `
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden faq-item" id="faq-${i}">
            <button class="w-full px-5 py-4 flex justify-between items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-laurette-500 faq-trigger" aria-expanded="false" aria-controls="faq-body-${i}">
                <span class="font-bold text-gray-900 text-sm pr-4">${faq.question}</span>
                <svg class="h-4 w-4 text-gray-400 faq-icon transition-transform flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="faq-content hidden px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-50 bg-gray-50/30 pt-4" id="faq-body-${i}">${faq.answer}</div>
        </div>
    `).join('');

    document.querySelectorAll('.faq-trigger').forEach(trigger => {
        trigger.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const icon    = this.querySelector('.faq-icon');
            const isOpen  = !content.classList.contains('hidden');

            document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
            document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));
            document.querySelectorAll('.faq-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));

            if (!isOpen) {
                content.classList.remove('hidden');
                icon.classList.add('rotate-180');
                this.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

// ==========================================
// 9. HELPERS UI
// ==========================================
function emptyState(title, subtitle = '', navTarget = null) {
    const link = navTarget
        ? `<button data-view="${navTarget}" class="nav-trigger-link mt-3 text-sm font-bold text-laurette-700 hover:underline">Commencer →</button>`
        : '';
    return `
    <div class="py-8 flex flex-col items-center gap-2 text-center">
        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1">
            <svg class="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
        </div>
        <p class="text-sm font-bold text-gray-500">${title}</p>
        ${subtitle ? `<p class="text-xs text-gray-400">${subtitle}</p>` : ''}
        ${link}
    </div>`;
}

// ==========================================
// 10. INITIALISATION
// ==========================================
setupEventListeners();
checkActiveSession();
