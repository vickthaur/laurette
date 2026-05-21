/**
 * ============================================================
 * LAURETTE FUGAIN × BDS — Moteur JavaScript (Vanilla)
 * ============================================================
 * Gère l'authentification, le routage, et la logique métier
 * connectée à Supabase.
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
// 3. GESTION DE L'AUTHENTIFICATION
// ==========================================

async function initAuth() {
    // Vérifier la session active au chargement
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        await handleSessionActive(session.user);
    } else {
        showAuthScreen();
    }

    // Ecouter les changements d'état
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            handleSessionActive(session.user);
        } else if (event === 'SIGNED_OUT') {
            showAuthScreen();
        }
    });

    // Soumission du formulaire de connexion
    DOM.auth.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        DOM.auth.submitBtn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Connexion...`;
        DOM.auth.submitBtn.disabled = true;
        DOM.auth.errorContainer.classList.add('hidden');

        const { error } = await supabase.auth.signInWithPassword({
            email: DOM.auth.email.value,
            password: DOM.auth.password.value
        });

        if (error) {
            DOM.auth.errorText.textContent = error.message === 'Invalid login credentials' 
                ? "Identifiants incorrects. Veuillez réessayer." 
                : error.message;
            DOM.auth.errorContainer.classList.remove('hidden');
            DOM.auth.submitBtn.innerHTML = `Accéder à mon espace`;
            DOM.auth.submitBtn.disabled = false;
        }
    });

    // Déconnexion
    DOM.sidebar.logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });
}

async function handleSessionActive(user) {
    State.user = user;
    DOM.views.auth.classList.add('hidden');
    DOM.views.app.classList.remove('hidden');
    
    await loadUserProfile();
    navigateTo('dashboard');
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
// 4. ROUTAGE ET NAVIGATION
// ==========================================

function setupNavigation() {
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            if(view) navigateTo(view);
        });
    });
}

function navigateTo(viewName) {
    State.currentView = viewName;
    
    // MAJ de l'UI Sidebar
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

    // Affichage des vues
    DOM.sections.forEach(section => {
        if (section.id === `content-${viewName}`) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });

    // Chargement dynamique des données selon la vue
    if (viewName === 'dashboard') loadDashboardData();
    if (viewName === 'events') loadEventsData();
    if (viewName === 'faq') loadFAQData();
}

// ==========================================
// 5. LOGIQUE METIER & APPELS API
// ==========================================

// --- Profil Utilisateur ---
async function loadUserProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .select(`*, bds (name)`)
        .eq('id', State.user.id)
        .single();

    if (!error && data) {
        State.profile = data;
        DOM.sidebar.userName.textContent = data.full_name || 'Ambassadeur';
        DOM.sidebar.bdsName.textContent = data.bds?.name || 'BDS Non assigné';
        DOM.sidebar.avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.full_name || 'U')}&background=5e227f&color=fff`;
    }
}

// --- Vue : Dashboard ---
async function loadDashboardData() {
    if (!State.profile?.bds_id) return;

    // 1. Compte des événements prévus
    const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('bds_id', State.profile.bds_id)
        .in('status', ['planned', 'confirmed']);
    
    DOM.dashboard.eventCount.textContent = eventsCount || 0;

    // 2. Compte des inscriptions (Flavy Code)
    const { count: regCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('bds_id', State.profile.bds_id)
        .eq('status', 'validated');

    DOM.dashboard.regCount.textContent = regCount || 0;

    // 3. Prochains événements (Mini liste)
    const { data: recentEvents } = await supabase
        .from('events')
        .select('title, event_date, type')
        .eq('bds_id', State.profile.bds_id)
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(4);

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

// --- Vue : Evénements (Tableau & Formulaire) ---
async function loadEventsData() {
    if (!State.profile?.bds_id) return;

    DOM.events.tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center"><div class="animate-pulse flex flex-col items-center"><div class="h-4 bg-gray-200 rounded w-1/4 mb-4"></div><div class="h-4 bg-gray-200 rounded w-1/2"></div></div></td></tr>`;

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('bds_id', State.profile.bds_id)
        .order('event_date', { ascending: false });

    if (error || !data.length) {
        DOM.events.tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500">Aucun événement trouvé. Créez-en un nouveau !</td></tr>`;
        return;
    }

    DOM.events.tableBody.innerHTML = data.map(ev => {
        const dateObj = new Date(ev.event_date);
        const badges = {
            'planned': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Planifié</span>',
            'confirmed': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Confirmé</span>',
            'completed': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Terminé</span>',
            'cancelled': '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Annulé</span>',
        };

        return `
        <tr class="hover:bg-gray-50 transition cursor-pointer">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-lg flex flex-col items-center justify-center border border-gray-200">
                        <span class="text-xs font-bold text-laurette-700 leading-none">${dateObj.getDate()}</span>
                        <span class="text-[10px] font-semibold text-gray-500 uppercase leading-none mt-1">${dateObj.toLocaleString('fr-FR', {month: 'short'})}</span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-bold text-gray-900">${ev.title}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900 capitalize">${ev.type}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                ${badges[ev.status] || badges['planned']}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <span class="text-gray-900 font-bold">${ev.actual_registrations}</span> <span class="text-gray-400">/ ${ev.expected_registrations}</span>
            </td>
        </tr>`;
    }).join('');
}

// Gestion Modal Evénements
DOM.events.btnCreate.addEventListener('click', () => {
    DOM.modal.container.classList.remove('hidden');
});

function closeModal() {
    DOM.modal.container.classList.add('hidden');
    DOM.modal.form.reset();
}

DOM.modal.btnCancel.addEventListener('click', closeModal);
DOM.modal.backdrop.addEventListener('click', closeModal);

DOM.modal.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!State.profile?.bds_id) return;

    const newEvent = {
        title: document.getElementById('event-title').value,
        event_date: document.getElementById('event-date').value,
        type: document.getElementById('event-type').value,
        expected_registrations: parseInt(document.getElementById('event-target').value),
        bds_id: State.profile.bds_id,
        created_by: State.user.id,
        status: 'planned'
    };

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Création...";
    submitBtn.disabled = true;

    const { error } = await supabase.from('events').insert([newEvent]);

    if (!error) {
        closeModal();
        loadEventsData(); // Rafraichir le tableau
        loadDashboardData(); // Rafraichir les stats
    } else {
        alert("Erreur lors de la création : " + error.message);
    }
    
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
});

// --- Vue : FAQ ---
async function loadFAQData() {
    if (State.faqs.length === 0) {
        const { data, error } = await supabase
            .from('faq_items')
            .select('*')
            .eq('is_active', true)
            .order('order_index', { ascending: true });
        
        if (!error && data) State.faqs = data;
    }

    if (State.faqs.length === 0) return;

    DOM.faq.container.innerHTML = State.faqs.map((faq, index) => `
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden faq-item transition-all duration-200">
            <button class="w-full px-6 py-5 flex justify-between items-center focus:outline-none focus:bg-gray-50 faq-trigger">
                <span class="font-bold text-gray-900 text-left">${faq.question}</span>
                <span class="ml-6 flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full border border-gray-200 faq-icon-container transition-colors">
                    <svg class="h-4 w-4 text-gray-500 faq-icon transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </span>
            </button>
            <div class="faq-content hidden px-6 pb-5 pt-1 text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50">
                ${faq.answer}
            </div>
        </div>
    `).join('');

    // Accordion Logic
    document.querySelectorAll('.faq-trigger').forEach(trigger => {
        trigger.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const icon = this.querySelector('.faq-icon');
            const iconContainer = this.querySelector('.faq-icon-container');
            const parent = this.closest('.faq-item');
            
            const isExpanded = !content.classList.contains('hidden');
            
            // Close all others (optionnel)
            document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
            document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));
            document.querySelectorAll('.faq-icon-container').forEach(ic => { ic.classList.remove('border-laurette-500', 'bg-laurette-50'); ic.classList.add('border-gray-200'); });
            document.querySelectorAll('.faq-item').forEach(pi => pi.classList.remove('ring-1', 'ring-laurette-500', 'shadow-md'));

            if (!isExpanded) {
                content.classList.remove('hidden');
                icon.classList.add('rotate-180');
                iconContainer.classList.remove('border-gray-200');
                iconContainer.classList.add('border-laurette-500', 'bg-laurette-50');
                parent.classList.add('ring-1', 'ring-laurette-500', 'shadow-md');
            }
        });
    });
}

// ==========================================
// 6. DEMARRAGE DE L'APP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupNavigation();
});
