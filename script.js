
"use strict";

document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS & GAME DATA ---
    const SAVE_KEY = 'uwlk4_save_vanilla_final';
    const COLORS = { SKIN: ['#ffdbac', '#f1c27d', '#e0ac69', '#8d5524', '#603813', '#321b06'], HAIR: ['#000000', '#1D1D1D', '#333333', '#4a4a4a', '#666666', '#999999', '#CCCCCC', '#ffffff', '#592f2a', '#6C3D36', '#A52A2A', '#B55A30', '#d4af37', '#FFBF00', '#ff4500', '#FF6347', '#4169e1', '#0000CD', '#8A2BE2', '#4B0082', '#008080'], CLOTH: ['#111111', '#2F4F4F', '#555555', '#708090', '#eeeeee', '#F5F5DC', '#8b0000', '#A52A2A', '#006400', '#556B2F', '#00008b', '#191970', '#4b0082', '#8B4513', '#9932CC', '#FF1493', '#ffd700', '#E6E6FA', '#00FFFF', '#7FFF00'], EYES: ['#000000', '#0000ff', '#552200'] };
    const NAMES = { LEGEND: ["Lionel Messy", "Chris Rolando", "Erling Bot", "Harry Pain", "Zinedine Zidance"], EPIC: ["Turbo Tom", "The Wall", "Iron Mike", "Rocket Ron"], COMMON_FIRST: ["Gary", "Steve", "Bob", "Dave", "Keith"], COMMON_LAST: ["Dull", "Boring", "Average", "Smith", "Jones"] };
    const CONTRACT_TIERS = { BRONZE: { name: 'BRONZE', req: 500, color: '#cd7f32' }, SILVER: { name: 'SILVER', req: 800, color: '#c0c0c0' }, GOLD: { name: 'GOLD', req: 1500, color: '#ffd700' }, PLATINUM: { name: 'PLATINUM', req: 5000, color: '#e5e4e2' } };
    const INTERACTION_RADIUS = 100;
    const FORMATIONS = { '442': [{ t: 85, l: 50, p: 'GK' }, { t: 65, l: 20, p: 'LB' }, { t: 65, l: 40, p: 'CB' }, { t: 65, l: 60, p: 'CB' }, { t: 65, l: 80, p: 'RB' }, { t: 40, l: 20, p: 'LM' }, { t: 40, l: 40, p: 'CM' }, { t: 40, l: 60, p: 'CM' }, { t: 40, l: 80, p: 'RM' }, { t: 15, l: 35, p: 'ST' }, { t: 15, l: 65, p: 'ST' }], '433': [{ t: 85, l: 50, p: 'GK' }, { t: 65, l: 20, p: 'LB' }, { t: 65, l: 40, p: 'CB' }, { t: 65, l: 60, p: 'CB' }, { t: 65, l: 80, p: 'RB' }, { t: 40, l: 30, p: 'CM' }, { t: 40, l: 50, p: 'CDM' }, { t: 40, l: 70, p: 'CM' }, { t: 15, l: 20, p: 'LW' }, { t: 15, l: 50, p: 'ST' }, { t: 15, l: 80, p: 'RW' }], '352': [{ t: 85, l: 50, p: 'GK' }, { t: 65, l: 30, p: 'CB' }, { t: 65, l: 50, p: 'CB' }, { t: 65, l: 70, p: 'CB' }, { t: 40, l: 15, p: 'LWB' }, { t: 40, l: 35, p: 'CM' }, { t: 40, l: 50, p: 'CAM' }, { t: 40, l: 65, p: 'CM' }, { t: 40, l: 85, p: 'RWB' }, { t: 15, l: 35, p: 'ST' }, { t: 15, l: 65, p: 'ST' }] };
    const INITIAL_STATE = { user: { name: "BOSS", login: false }, club: { coins: 0, fans: 0, inv: { agents: 0, scouts: 0 }, kit: { p: '#f00', s: '#fff' }, emblem: { p: '#00f', s: '#fff' }, home: null }, manager: { look: { h: 0, hc: 0, s: 0, kit: 0, boots: 0, eyeColor:0 }, stats: { dist: 0, playersSigned: 0, playersSold: 0, apparelFound: 0, cashEarned: 0, cashSpent: 0 }, unlockedCosmetics: { h: [0, 1, 2, 3, 4, 5], hc: [0, 1, 2, 3, 4, 5, 6, 7], j: [0, 1, 2], t: [0, 1, 2], a: [0, 1, 3, 9] } }, settings: { sound: true, haptics: true, defaultZoom: 17 }, squad: [], team: new Array(11).fill(null), formation: '442', activeContracts: [null, null], storage: new Array(9).fill(null), world: { items: [] }, achievements: [], lastLoc: null, pendingPlayer: null };

    // --- STATE & APP MANAGEMENT ---
    let state = {};
    let currentView = 'map';
    let isMoving = false;
    let appContainer = document.getElementById('app');
    let mapInstance = null;
    let managerMarker = null, rangeCircle = null;
    const poiMarkers = new Map();
    let movementTimeout = null;
    let toastTimeout = null;
    
    // --- VIEW-SPECIFIC STATE ---
    let selectedPitchSlot = -1;
    let viewingPlayerId = null;

    // --- SERVICES ---
    const playSound = (sound) => { if(state.settings.sound) { /* TODO: Add audio logic */ } };
    const vibrate = () => { if(state.settings.haptics && navigator.vibrate) navigator.vibrate(100); };
    const saveGame = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) { console.error("Failed to save game", e); } };
    const loadGame = () => { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; };
    const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);
    const deepMerge = (target, source) => {
        let output = { ...target };
        if (isObject(target) && isObject(source)) {
            Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                    if (!(key in target)) Object.assign(output, { [key]: source[key] });
                    else output[key] = deepMerge(target[key], source[key]);
                } else { Object.assign(output, { [key]: source[key] }); }
            });
        }
        return output;
    };
    
    // --- CORE GAME LOGIC ---
    const login = (name) => { state.user.name = name; state.user.login = true; saveGame(); render(); };
    
    const generatePlayer = (tier) => {
        let min = 60, max = 75;
        const r = Math.random();
        if (tier === 'BRONZE') { if (r > 0.8) { min = 75; max = 79; } else { min = 60; max = 74; } }
        else if (tier === 'SILVER') { if (r > 0.99) { min = 85; max = 89; } else if (r > 0.9) { min = 80; max = 84; } else if (r > 0.6) { min = 75; max = 79; } }
        else if (tier === 'GOLD') { if (r > 0.98) { min = 90; max = 99; } else if (r > 0.9) { min = 85; max = 89; } else if (r > 0.5) { min = 80; max = 84; } else { min = 75; max = 79; } }
        else if (tier === 'PLATINUM') { if (r > 0.9) { min = 90; max = 99; } else if (r > 0.5) { min = 85; max = 89; } else { min = 80; max = 84; } }
        
        const ovr = Math.floor(Math.random() * (max - min + 1)) + min;
        let name = "";
        if (ovr >= 90) name = `MYTHIC ${NAMES.LEGEND[Math.floor(Math.random() * NAMES.LEGEND.length)]}`;
        else if (ovr >= 85) name = NAMES.LEGEND[Math.floor(Math.random() * NAMES.LEGEND.length)];
        else if (ovr >= 80) name = NAMES.EPIC[Math.floor(Math.random() * NAMES.EPIC.length)];
        else name = `${NAMES.COMMON_FIRST[Math.floor(Math.random() * NAMES.COMMON_FIRST.length)]} ${NAMES.COMMON_LAST[Math.floor(Math.random() * NAMES.COMMON_LAST.length)]}`;
        
        return {
            id: Date.now() + Math.floor(Math.random() * 999999), name, ovr,
            pos: ['GK', 'DEF', 'MID', 'FWD'][Math.floor(Math.random() * 4)],
            look: {
                s: Math.floor(Math.random() * COLORS.SKIN.length), hc: Math.floor(Math.random() * COLORS.HAIR.length), h: Math.floor(Math.random() * 4),
                kit: Math.floor(Math.random() * COLORS.CLOTH.length), boots: Math.floor(Math.random() * COLORS.CLOTH.length), eyeColor: Math.floor(Math.random() * COLORS.EYES.length)
            }
        };
    };

    const claimContract = (activeIndex) => {
        const contract = state.activeContracts[activeIndex];
        if (!contract || !contract.completed) return;

        state.pendingPlayer = generatePlayer(contract.tier);
        state.activeContracts[activeIndex] = null;
        render(); // Re-render to show the reveal modal
    };

    const keepPlayer = () => {
        if (!state.pendingPlayer) return;
        state.squad.push(state.pendingPlayer);
        state.manager.stats.playersSigned += 1;
        state.pendingPlayer = null;
        showToast("Player Signed!");
        render();
    };

    const updateLocation = (latLng) => {
        const isFirstUpdate = !state.lastLoc;
        const currentLatLng = L.latLng(latLng);
        let distance = 0;
        if (state.lastLoc) {
            distance = L.latLng(state.lastLoc).distanceTo(currentLatLng);
        }

        if (distance > 1) {
            isMoving = true;
            if (movementTimeout) clearTimeout(movementTimeout);
            movementTimeout = window.setTimeout(() => { isMoving = false; updateMap(); }, 2000);
        }

        if (!isFirstUpdate && distance > 0) {
            state.manager.stats.dist += distance;
            state.activeContracts.forEach(c => {
                if (c && !c.completed) {
                    c.prog += distance;
                    if (c.prog >= c.req) { c.prog = c.req; c.completed = true; }
                }
            });
        }
        
        state.lastLoc = latLng;
        updateMap();
    };

    // --- RENDERING ---
    function render() {
        if (!appContainer) return;
        let html = '';
        if (!state.user.login) {
            html = renderTitleScreen();
        } else {
            html = renderGameUI();
        }
        appContainer.innerHTML = html;
        if (state.user.login) {
            renderCurrentView();
        }
        if (state.pendingPlayer) {
            renderContractReveal();
        }
        attachEventListeners();
    }

    function renderTitleScreen() {
        return `<div id="title-screen">
                    <h1>UWLK4<br/><span>MANAGER</span></h1>
                    <div class="start-prompt animate-pulse-glow">TAP TO START</div>
                    ${state.user.login && state.user.name !== 'BOSS' ? `<div class="save-info">CONTINUING CAREER AS ${state.user.name}</div>` : ''}
                </div>`;
    }

    function renderGameUI() {
        return `<div id="toast"></div><div id="view-container"></div>${renderNavBar()}`;
    }

    function renderNavBar() {
        const navItems = [{ view: 'map', label: 'MAP' }, { view: 'squad', label: 'SQUAD' }];
        return `<div id="nav-bar">
                    ${navItems.map(item => `<div class="nav-button ${currentView === item.view ? 'active' : ''}" data-view="${item.view}">${item.label}</div>`).join('')}
                </div>`;
    }

    function renderCurrentView() {
        const viewContainer = document.getElementById('view-container');
        if (!viewContainer) return;

        if (mapInstance) { mapInstance.remove(); mapInstance = null; }
        document.querySelector('.modal-backdrop')?.remove();

        switch (currentView) {
            case 'map': viewContainer.innerHTML = renderMapView(); initializeMap(); break;
            case 'squad': viewContainer.innerHTML = renderSquadView(); break;
            default: viewContainer.innerHTML = `<div class="view-header"><h1 class="view-title">${currentView.toUpperCase()}</h1><p>Coming soon!</p></div>`;
        }
        attachViewEventListeners();
    }
    
    // --- MAP VIEW ---
    function renderMapView() { return `<div id="map"></div><button id="map-recenter-btn">🎯</button>`; }
    function initializeMap() {
        if (document.getElementById('map') && !mapInstance) {
            const initialLatLng = state.lastLoc || [51.505, -0.09];
            mapInstance = L.map('map', { zoomControl: false, attributionControl: false }).setView(initialLatLng, state.settings.defaultZoom);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);
            
            if(state.lastLoc) {
                managerMarker = L.marker(initialLatLng, { icon: createManagerIcon() }).addTo(mapInstance);
                rangeCircle = L.circle(initialLatLng, { radius: INTERACTION_RADIUS, color: '#00e5ff', weight: 2, fill: false }).addTo(mapInstance);
            }
            if (navigator.geolocation) {
                navigator.geolocation.watchPosition(
                    pos => updateLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    err => console.error("Geolocation error", err), { enableHighAccuracy: true }
                );
            }
        }
    }
    function updateMap() {
        if (!mapInstance || !state.lastLoc) return;
        const latLng = state.lastLoc;
        mapInstance.panTo(latLng);
        if (managerMarker) managerMarker.setLatLng(latLng).setIcon(createManagerIcon());
        if (rangeCircle) rangeCircle.setLatLng(latLng);
    }
    
    function createManagerIcon() {
        return L.divIcon({
            className: '',
            html: `<div style="position:relative; width:64px; height:64px;">
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);">
                           ${getPixelPersonSVG(state.manager.look, true, isMoving)}
                        </div>
                        <div class="animate-ripple" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); border:5px solid var(--primary-color); border-radius:50%;"></div>
                   </div>`,
            iconSize: [64, 64], iconAnchor: [32, 32],
        });
    }

    // --- SQUAD VIEW ---
    function renderSquadView() {
        const teamPlayers = state.team.filter(p => p);
        const avgOvr = teamPlayers.length > 0 ? Math.floor(teamPlayers.reduce((sum, p) => sum + p.ovr, 0) / teamPlayers.length) : 0;
        return `<div class="view-header">
                    <h1 class="view-title">SQUAD</h1>
                    <span>RATING: ${avgOvr}</span>
                </div>
                <div style="padding:1rem;">
                    <div class="squad-pitch">
                        ${FORMATIONS[state.formation].map((pos, i) => renderPitchSlot(pos, i)).join('')}
                    </div>
                </div>`;
    }
    function renderPitchSlot(pos, i) {
        const player = state.team[i];
        return `<div class="pitch-slot ${selectedPitchSlot === i ? 'selected' : ''}" style="top:${pos.t}%; left:${pos.l}%" data-slot-index="${i}">
                    ${player ? `<div class="player-icon">${getPixelPersonSVG(player.look)}</div><div class="player-ovr">${player.ovr}</div>` : pos.p}
                </div>`;
    }

    function renderContractReveal() {
        let isFlipping = false;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        
        modal.innerHTML = `
            <div class="text-center">
                <div class="perspective" style="width:260px; height:380px;">
                    <div class="flipper w-full h-full">
                        <div class="front w-full h-full cursor-pointer">${SVGs.ContractIcon()}</div>
                        <div class="back w-full h-full">${renderPlayerCard(state.pendingPlayer)}</div>
                    </div>
                </div>
                <div style="font-size:1.875rem; color:var(--highlight-color); margin-top:1rem;">CONTRACT COMPLETE!</div>
                <div class="reveal-prompt" style="font-size:1.25rem; color:white; margin-top:0.5rem;">TAP TO SIGN</div>
            </div>`;
        
        const flipper = modal.querySelector('.flipper');
        modal.addEventListener('click', () => {
            if (!isFlipping) {
                isFlipping = true;
                flipper.classList.add('flipped');
                playSound('collect');
                vibrate();
                modal.querySelector('.reveal-prompt').textContent = ' ';
            }
        });
        
        appContainer.appendChild(modal);
    }
    
    function renderPlayerCard(player) {
         const ovr = player.ovr;
         let rarity = 'common';
         if (ovr >= 90) rarity = 'mythic'; else if (ovr >= 85) rarity = 'legend'; else if (ovr >= 80) rarity = 'epic'; else if (ovr >= 75) rarity = 'rare';
        return `
            <div class="player-card bg-${rarity}">
                <div style="text-align:center; background:rgba(0,0,0,0.6); color:white; padding:0.25rem 0;">${player.name}</div>
                <div style="flex-grow:1; display:flex; align-items:center; justify-content:center;">${getPixelPersonSVG(player.look)}</div>
                <button class="player-card-btn">SIGN PLAYER</button>
            </div>
        `;
    }


    // --- EVENT LISTENERS ---
    function attachEventListeners() {
        const titleScreen = document.getElementById('title-screen');
        if (titleScreen) titleScreen.addEventListener('click', () => login(state.user.name || 'BOSS'));
        
        document.querySelectorAll('.nav-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                if (view !== currentView) { currentView = view; render(); }
            });
        });

        document.querySelectorAll('.player-card-btn').forEach(btn => {
            btn.addEventListener('click', keepPlayer);
        });
    }

    function attachViewEventListeners() {
        if (currentView === 'map') {
            document.getElementById('map-recenter-btn')?.addEventListener('click', updateMap);
        }
        if (currentView === 'squad') {
            document.querySelectorAll('.pitch-slot').forEach(slot => {
                slot.addEventListener('click', (e) => {
                    selectedPitchSlot = parseInt(e.currentTarget.dataset.slotIndex, 10);
                    renderCurrentView(); // Re-render to show selection
                });
            });
        }
    }

    // --- HELPERS ---
    const showToast = (message) => {
        const toast = document.getElementById('toast');
        if (!toast) return;
        if(toastTimeout) clearTimeout(toastTimeout);
        toast.innerHTML = message;
        toast.classList.add('visible');
        toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
    };

    const getPixelPersonSVG = (look, isMgr = false, isWalking = false) => {
        const skin = COLORS.SKIN[look.s]; const hair = COLORS.HAIR[look.hc]; const eye = COLORS.EYES[look.eyeColor];
        const kit = COLORS.CLOTH[look.kit]; const boots = COLORS.CLOTH[look.boots];
        return `<svg viewBox="0 0 24 24" style="width:100%; height:100%;"><g class="${isWalking ? 'walking-body' : ''}">
        <path d="M9,8 H15 V10 H9z M9,10 H15 V12 H9z M9,12 H15 V14 H9z" fill="${kit}"/>
        <path d="M10,14 H14 V16 H10z" fill="${boots}"/>
        <path d="M10,6 H14 V8 H10z" fill="${skin}"/>
        <path d="M10,4 H14 V6 H10z" fill="${hair}"/><path d="M11,7 H13 V8 H11z" fill="${eye}"/>
        </g></svg>`;
    };
    
    const SVGs = {
        ContractIcon: () => `<svg viewBox="0 0 260 380" style="width:100%; height:100%;"><rect width="260" height="380" fill="#1a1a1a" rx="15"/><path d="M50 30 H210 V350 H50z" fill="#333"/><text x="130" y="190" fill="#00e5ff" font-size="90" text-anchor="middle" font-family="VT323">?</text></svg>`
    };
    
    // --- INITIALIZATION ---
    function main() {
        let loadedState = loadGame();
        state = deepMerge(INITIAL_STATE, loadedState || {});
        if (!FORMATIONS[state.formation]) state.formation = '442';
        
        // Mock contract for testing
        state.activeContracts[0] = { tier: 'GOLD', req: 10, prog: 8, completed: false };
        state.activeContracts[1] = { tier: 'SILVER', req: 500, prog: 500, completed: true };

        render();
    }

    main();
});