/**
 * ============================================================
 * LAURETTE FUGAIN × BDS — Moteur JavaScript Évolué (Anti-Crash)
 * ============================================================
 */

// ==========================================
// 1. INITIALISATION SUPABASE & ETAT GLOBAL
// ==========================================
const SUPABASE_URL = 'https://lhelfggczeybornhemsf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rvOSgbkjsZRcwGCenkzY_g_5am-b6dk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const State = {
    user: null,
    profile: null,
    currentView: 'dashboard',
    events: [],
    faqs: []
};

// ==========================================
// 2. CACHE DES ELEMENTS DU DOM
// ==========================================
const DOM = {
    views: {
        auth: document.getElementById('view-auth'),
        app: document.getElementById('app-shell')
    },
    sections: document.querySelectorAll('.view-section'),
    navItems: document.querySelectorAll('.nav-item'),
    headerTitle: document.getElementById('header-title'),
    auth: {
        form: document.getElementById('auth-form'),
        email: document.getElementById('email'),
        password: document.getElementById('password'),
        errorContainer: document.getElementById('auth-error-message'),
        errorText: document.getElementById('auth-error-text'),
        submitBtn: document.getElementById('auth-submit-btn')
    },
    sidebar: {
        userName: document.getElementById('sidebar-user-name'),
        bdsName: document.getElementById('sidebar-bds-name'),
        avatar: document.getElementById('sidebar-avatar'),
        logoutBtn: document.getElementById('btn-logout')
    },
    dashboard: {
        regCount: document.getElementById('dash-reg-count'),
        eventCount: document.getElementById('dash-event-count'),
        rank: document.getElementById('dash-rank'),
        recentEvents: document.getElementById('dash-recent-events')
    },
    events: {
        tableBody: document.getElementById('events-table-body'),
        btnCreate: document.getElementById('btn-create-event')
    },
    modal: {
        container: document.getElementById('modal-event'),
        backdrop: document.getElementById('modal-event-backdrop'),
        form: document.getElementById('form-create-event'),
        btnCancel: document.getElementById('btn-cancel-event')
    },
    faq: {
        container: document.getElementById('faq-accordion-container')
    }
};

// ==========================================
// 3. ATTACHEMENT SYNCHRONE DES ÉCOUTEURS (SÉCURITÉ)
// ==========================================
function setupEventListeners() {
    // Bloquer le comportement natif du formulaire de connexion INSTANTANÉMENT
    if (DOM.auth.form) {
        DOM.auth.form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Bloque le rechargement de page et l'écriture dans l'URL
            e.stopPropagation();
            
            DOM.auth.submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Connexion en cours...`;
            DOM.auth.submitBtn.disabled = true;
            DOM.auth.errorContainer.classList.add('hidden');

            const { data, error } = await supabase.auth.signInWithPassword({
                email: DOM.auth.email.value.trim(),
                password: DOM.auth.password.value
            });

            if (error) {
                DOM.auth.errorText.textContent = error.message === 'Invalid login credentials' 
                    ? "Identifiants incorrects. Vérifie ton email et mot de passe." 
                    : error.message;
                DOM.auth.errorContainer.classList.remove('hidden');
                DOM.auth.submitBtn.innerHTML = `Accéder à mon espace`;
                DOM.auth.submitBtn.disabled = false;
            }
        });
    }

    // Écouteurs de la barre de navigation
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if (view) navigateTo(view);
        });
    });

    // Déconnexion
    if (DOM.sidebar.logoutBtn) {
        DOM.sidebar.logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.search = ''; // Nettoie les paramètres d'URL si présents
        });
    }

    // Modale Événements
    if (DOM.events.btnCreate) DOM.events.btnCreate.addEventListener('click', () => DOM.modal.container.classList.remove('hidden'));
    if (DOM.modal.btnCancel) DOM.modal.btnCancel.addEventListener('click', closeModal);
    if (DOM.modal.backdrop) DOM.modal.backdrop.addEventListener('click', closeModal);
    
    if (DOM.modal.form) {
        DOM.modal.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!State.profile?.bds_id) return;

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;

            const { error } = await supabase.from('events').insert([{
                title: document.getElementById('event-title').value,
                event_date: document.getElementById('event-date').value,
                type: document.getElementById('event-type').value,
                expected_registrations: parseInt(document.getElementById('event-target').value) || 0,
                bds_id: State.profile.bds_id,
                created_by: State.user.id,
                status: 'planned'
            }]);

            if (!error) {
                closeModal();
                loadEventsData();
                loadDashboardData();
            } else {
                alert("Erreur : " + error.message);
            }
            submitBtn.disabled = false;
        });
    }
}

function closeModal() {
    DOM.modal.container.classList.add('hidden');
    DOM.modal.form.reset();
}

// ==========================================
// 4. GESTION ASYNCHRONE DES SESSIONS
// ==========================================
async function checkActiveSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
            State.user = session.user;
            DOM.views.auth.classList.add('hidden');
            DOM.views.app.classList.remove('hidden');
            await loadUserProfile();
            navigateTo('dashboard');
        } else {
            showAuthScreen();
        }
    } catch (err) {
        console.error("Erreur d'initialisation Supabase:", err);
        DOM.auth.errorText.textContent = "Erreur de liaison réseau. Vérifie que ton VPN ne bloque pas Supabase.";
        DOM.auth.errorContainer.classList.remove('hidden');
    }

    // Écouter les changements au fil de l'eau
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            State.user = session.user;
            DOM.views.auth.classList.add('hidden');
            DOM.views.app.classList.remove('hidden');
            loadUserProfile().then(() => navigateTo('dashboard'));
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });
}

function showAuthScreen() {
    State.user = null;
    State.profile = null;
    DOM.views.app.classList.add('hidden');
    DOM.views.auth.classList.remove('hidden');
    DOM.auth.submitBtn.innerHTML = `Accéder à mon espace`;
    DOM.auth.submitBtn.disabled = false;
}

// ==========================================
// 5. ROUTAGE ET AFFICHAGE DES VUES
// ==========================================
function navigateTo(viewName) {
    State.currentView = viewName;
    
    DOM.navItems.forEach(item => {
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('bg-laurette-50', 'text-laurette-700');
            item.classList.remove('text-gray-700', 'hover:bg-gray-50');
            DOM.headerTitle.textContent = item.textContent.trim();
        } else {
            item.classList.remove('bg-laurette-50', 'text-laurette-700');
            item.classList.add('text-gray-700', 'hover:bg-gray-50');
        }
    });

    DOM.sections.forEach(section => {
        section.id === `content-${viewName}` ? section.classList.remove('hidden') : section.classList.add('hidden');
    });

    if (viewName === 'dashboard') loadDashboardData();
    if (viewName === 'events') loadEventsData();
    if (viewName === 'faq') loadFAQData();
}

// ==========================================
// 6. CHARGEMENT DES DONNÉES DEPUIS SUPABASE
// ==========================================
async function loadUserProfile() {
    if (!State.user) return;
    const { data, error } = await supabase
        .from('profiles')
        .select(`*, bds (name)`)
        .eq('id', State.user.id)
        .single();

    if (!error && data) {
        State.profile = data;
        DOM.sidebar.userName.textContent = data.full_name || 'Ambassadeur';
        DOM.sidebar.bdsName.textContent = data.bds?.name || 'BDS Externe';
        DOM.sidebar.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'A')}&background=5e227f&color=fff`;
    }
}

async function loadDashboardData() {
    if (!State.profile?.bds_id) return;

    const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('bds_id', State.profile.bds_id).in('status', ['planned', 'confirmed']);
    DOM.dashboard.eventCount.textContent = eventsCount || 0;

    const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('bds_id', State.profile.bds_id).eq('status', 'validated');
    DOM.dashboard.regCount.textContent = regCount || 0;

    const { data: recentEvents } = await supabase.from('events').select('title, event_date, type').eq('bds_id', State.profile.bds_id).order('event_date', { ascending: true }).limit(4);

    if (recentEvents && recentEvents.length > 0) {
        DOM.dashboard.recentEvents.innerHTML = recentEvents.map(ev => `
            <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50 transition">
                <div>
                    <p class="text-sm font-bold text-gray-900">${ev.title}</p>
                    <p class="text-xs text-gray-500 capitalize">${ev.type}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold text-laurette-700">${new Date(ev.event_date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}</p>
                </div>
            </div>
        `).join('');
    } else {
        DOM.dashboard.recentEvents.innerHTML = `<div class="p-8 text-center text-gray-500 text-sm">Aucun événement planifié.</div>`;
    }
}

async function loadEventsData() {
    if (!State.profile?.bds_id) return;

    const { data, error } = await supabase.from('events').select('*').eq('bds_id', State.profile.bds_id).order('event_date', { ascending: false });

    if (error || !data.length) {
        DOM.events.tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">Aucun événement enregistré pour le moment.</td></tr>`;
        return;
    }

    DOM.events.tableBody.innerHTML = data.map(ev => {
        const dateObj = new Date(ev.event_date);
        const badges = {
            'planned': '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Planifié</span>',
            'confirmed': '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Confirmé</span>',
            'completed': '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Terminé</span>',
            'cancelled': '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Annulé</span>'
        };
        return `
        <tr class="hover:bg-gray-50 border-b border-gray-100">
            <td class="px-6 py-4 whitespace-nowrap flex items-center">
                <div class="h-10 w-10 bg-gray-50 rounded-lg flex flex-col items-center justify-center border border-gray-200">
                    <span class="text-xs font-bold text-laurette-700">${dateObj.getDate()}</span>
                    <span class="text-[9px] font-bold text-gray-400 uppercase">${dateObj.toLocaleString('fr-FR', {month: 'short'})}</span>
                </div>
                <div class="ml-4 text-sm font-bold text-gray-900">${ev.title}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">${ev.type}</td>
            <td class="px-6 py-4 whitespace-nowrap">${badges[ev.status] || badges['planned']}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">${ev.actual_registrations} <span class="text-gray-400 font-normal">/ ${ev.expected_registrations}</span></td>
        </tr>`;
    }).join('');
}

async function loadFAQData() {
    if (State.faqs.length === 0) {
        const { data } = await supabase.from('faq_items').select('*').eq('is_active', true).order('order_index', { ascending: true });
        if (data) State.faqs = data;
    }

    DOM.faq.container.innerHTML = State.faqs.map(faq => `
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden faq-item transition-all">
            <button class="w-full px-6 py-4 flex justify-between items-center text-left focus:outline-none faq-trigger">
                <span class="font-bold text-gray-900">${faq.question}</span>
                <svg class="h-4 w-4 text-gray-400 faq-icon transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div class="faq-content hidden px-6 pb-4 text-gray-600 text-sm border-t border-gray-50 bg-gray-50/50 pt-3">${faq.answer}</div>
        </div>
    `).join('');

    document.querySelectorAll('.faq-trigger').forEach(trigger => {
        trigger.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const icon = this.querySelector('.faq-icon');
            const isOpen = !content.classList.contains('hidden');
            
            document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
            document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));

            if (!isOpen) {
                content.classList.remove('hidden');
                icon.classList.add('rotate-180');
            }
        });
    });
}

// ==========================================
// 7. INITIALISATION RUNTIME
// ==========================================
setupEventListeners();
checkActiveSession();
