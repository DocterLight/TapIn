let pendingDrinkRemoval = null;
let pinAction = null;
document.addEventListener('DOMContentLoaded', () => {
  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('Service Worker geregistreerd met scope:', reg.scope))
        .catch(err => console.log('Service Worker registratie mislukt:', err));
    });
  }

  const DEFAULT_GLOBAL_LIMIT = 25;

  function getGlobalLimit() {
    const savedLimit = Number(localStorage.getItem('globalLimit'));
    return Number.isFinite(savedLimit) && savedLimit > 0
      ? savedLimit
      : DEFAULT_GLOBAL_LIMIT;
  }

  function evaluateMemberStatus(member) {
    if (member.exempt) {
      member.isBlocked = false;
      return member;
    }
  
    member.isBlocked = (member.totalAmount || 0) >= getGlobalLimit();
    return member;
  }

  const notificationQueue = {};

  function batchNotify(key, messageBuilder, delay = 800) {
    if (!notificationQueue[key]) {
      notificationQueue[key] = {
        count: 0,
        timeout: null,
        data: null
      };
    }
  
    const item = notificationQueue[key];
    item.count++;
  
    clearTimeout(item.timeout);
  
    item.timeout = setTimeout(() => {
      const msg = messageBuilder(item.count);
      notify(msg);
      delete notificationQueue[key];
    }, delay);
  }

  function safeAddLog(entry) {
    const logs = JSON.parse(localStorage.getItem("logs")) || [];
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {}
  
    logs.push({
      ...entry,
      performedBy: entry.performedBy || session?.memberName || 'Onbekend',
      performedByLoginId: entry.performedByLoginId || session?.loginId || '',
      timestamp: Date.now()
    });
  
  }

  // --- Elements ---
  const ledenUl = document.getElementById('ledenUl');
  const memberFilterButton = document.getElementById('memberFilterButton');
  const memberFilterMenu = document.getElementById('memberFilterMenu');
  const favoriteFilterCheckbox = document.getElementById('favoriteFilterCheckbox');
  const nicknamesCheckbox = document.getElementById('nicknamesCheckbox');
  const noFavoriteMembers = document.getElementById('noFavoriteMembers');
  const appContainer = document.getElementById('container');
  const loginScreen = document.getElementById('loginScreen');
  const loginForm = document.getElementById('loginForm');
  const loginIdInput = document.getElementById('loginIdInput');
  const loginError = document.getElementById('loginError');
  const registrationScreen = document.getElementById('registrationScreen');
  const registrationForm = document.getElementById('registrationForm');
  const registrationNameInput = document.getElementById('registrationNameInput');
  const registrationPinInput = document.getElementById('registrationPinInput');
  const registrationPinConfirmInput = document.getElementById('registrationPinConfirmInput');
  const registrationError = document.getElementById('registrationError');
  const logoutButton = document.getElementById('logoutButton');
  const sessionUser = document.getElementById('sessionUser');
  const totaalBedragEl = document.getElementById('totaalBedrag');
  const adminButton = document.getElementById('adminButton');
  const statisticsButton = document.getElementById('statisticsButton');

  const ledenLijstSection = document.getElementById('ledenLijst');
  const drankjesLijstSection = document.getElementById('drankjesLijst');
  const drankjesUl = document.getElementById('drankjesUl');
  const currentMemberNameSpan = document.getElementById('currentMemberName');
  const backToLedenButton = document.getElementById('backToLeden');
  const confirmOrderButton = document.getElementById('confirmOrder');
  const drankjesDetails = document.getElementById('drankjesDetails');

  const confirmationModal = document.getElementById('confirmationModal');
  const confirmPaymentButton = document.getElementById('confirmPayment');
  const closeModalButton = document.getElementById('closeModal');

  const headerLogo = document.getElementById('headerLogo');
  let showFavoritesOnly = false;
  let automaticLogoutTimer = null;

  function nicknamesAreEnabled() {
    return localStorage.getItem('nicknamesEnabled') !== 'false';
  }

  function updateFilterControls() {
    if (favoriteFilterCheckbox) favoriteFilterCheckbox.checked = showFavoritesOnly;
    if (nicknamesCheckbox) nicknamesCheckbox.checked = nicknamesAreEnabled();
    if (memberFilterButton) {
      memberFilterButton.textContent = '▾';
      memberFilterButton.title = 'Filter';
      memberFilterButton.classList.remove('active');
    }
    updateSessionUserLabel();
  }
  

  // --- Notificatie helper (shared popup als beschikbaar) ---
  function notify(message) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message);
    } else {
      alert(message);
    }
  }

  // --- Dark mode toepassen bij laden ---
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }

  // --- Logo wisselen (custom > light/dark standaard) ---
  function updateLogo() {
    const customLogo = localStorage.getItem('customLogo')
      || (JSON.parse(localStorage.getItem('customLayout') || '{}').logo)
      || localStorage.getItem('logoImage'); // legacy

    if (customLogo) {
      if (headerLogo) headerLogo.src = customLogo;
      return;
    }
    // standaard: wissel o.b.v. dark-mode
    if (headerLogo) {
      headerLogo.src = document.body.classList.contains('dark-mode')
        ? 'assets/images/logo-dark.png'
        : 'assets/images/logo-light.png';
    }
  }

  // --- Achtergrond toepassen (custom > legacy) ---
  function applyBackground() {
    const customBackground = localStorage.getItem('customBackground')
      || (JSON.parse(localStorage.getItem('customLayout') || '{}').background)
      || localStorage.getItem('backgroundImage'); // legacy

    if (customBackground) {
      document.body.style.backgroundImage = `url(${customBackground})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    }
  }

  // init visuals
  updateLogo();
  applyBackground();

  // Live preview (optioneel aangeroepen vanuit admin)
  window.applyLivePreview = function (customLogo, customBackground) {
    if (customLogo && headerLogo) headerLogo.src = customLogo;
    if (customBackground) {
      document.body.style.backgroundImage = `url(${customBackground})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    }
  };

  // Reageer op theme switch vanuit andere tab (optioneel nice-to-have)
  window.addEventListener('storage', (e) => {
    if (e.key === 'darkMode') {
      if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      updateLogo();
    }
    if (e.key === 'customLogo' || e.key === 'customBackground' || e.key === 'customLayout') {
      updateLogo();
      applyBackground();
    }
    if (e.key === 'leden') loadLedenList();
    if (e.key === 'nicknamesEnabled') {
      updateFilterControls();
      loadLedenList();
    }
  });

  // --- Navigatie knoppen ---
  if (adminButton) adminButton.addEventListener('click', () => {
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {}
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const currentMember = leden.find(member =>
      member.loginId === session?.loginId && member.name === session?.memberName
    );
    if (!currentMember?.isAdmin) {
      notify('Alleen een beheerder met een ADMIN-ID heeft toegang tot het adminpaneel.');
      return;
    }
    location.href = 'admin.html';
  });
  if (statisticsButton) statisticsButton.addEventListener('click', () => (location.href = 'statistics.html'));

  // --- Ledenlijst laden ---
  function loadLedenList() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const useNicknames = nicknamesAreEnabled();
    leden.sort((a, b) => {
      const favoriteDifference = Number(b.favorite === true) - Number(a.favorite === true);
      const nameA = (useNicknames && a.nickname ? a.nickname : a.name || '').trim();
      const nameB = (useNicknames && b.nickname ? b.nickname : b.name || '').trim();
      return favoriteDifference || nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' });
    });

    const visibleMembers = showFavoritesOnly
      ? leden.filter(member => member.favorite === true)
      : leden;

    let totaal = 0;
    const frag = document.createDocumentFragment();

    visibleMembers.forEach(member => {
      if (!member?.name) return;
      const li = document.createElement('li');
      const totalForMember = Number(member.totalAmount || 0);
      const displayName = (useNicknames && member.nickname ? member.nickname : member.name).trim();

      li.innerHTML = `
          <span style="font-weight:700;"></span>
          <span>€${totalForMember.toFixed(2)}</span>
        `;
      li.querySelector('span').textContent = `${showFavoritesOnly && member.favorite === true ? '⭐ ' : ''}${displayName}`;
      li.addEventListener('click', () => showDrankjesLijst(member.name));

      frag.appendChild(li);
      totaal += totalForMember;
    });

    ledenUl.innerHTML = '';
    ledenUl.appendChild(frag);

    if (noFavoriteMembers) {
      noFavoriteMembers.hidden = !(showFavoritesOnly && visibleMembers.length === 0);
    }

    if (totaalBedragEl) {
      totaalBedragEl.textContent = `Totaal: €${totaal.toFixed(2)}`;
    }
  }

  function loginIdBase(name) {
    const characters = String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[A-Za-z0-9]/g) || [];
    const first = characters[0] || 'X';
    const last = characters[characters.length - 1] || 'X';
    return `${first}${last}`.toUpperCase();
  }

  function ensureMemberLoginIds() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const usedIds = new Set(leden.map(member => String(member.loginId || '').toUpperCase()).filter(Boolean));
    let counter = Math.max(1, Number(localStorage.getItem('loginIdCounter')) || 1);
    let changed = false;

    leden.forEach(member => {
      if (member.loginId) return;
      let candidate;
      do {
        candidate = `${loginIdBase(member.name)}${counter}`;
        counter += 1;
      } while (usedIds.has(candidate));
      member.loginId = candidate;
      usedIds.add(candidate);
      changed = true;
    });

    if (changed) localStorage.setItem('leden', JSON.stringify(leden));
    localStorage.setItem('loginIdCounter', String(counter));
    return leden;
  }

  function getSessionTimeoutMinutes() {
    const savedTimeout = Number(localStorage.getItem('sessionTimeoutMinutes'));
    return Number.isFinite(savedTimeout) && savedTimeout >= 1 ? savedTimeout : 30;
  }

  function showLoggedInApp(member) {
    loginScreen?.classList.add('hidden');
    registrationScreen?.classList.add('hidden');
    appContainer?.classList.remove('app-locked');
    appContainer?.setAttribute('aria-hidden', 'false');
    if (sessionUser) {
      const displayName = nicknamesAreEnabled() && member.nickname ? member.nickname : member.name;
      sessionUser.textContent = `Ingelogd: ${displayName}`;
    }
  }

  function updateSessionUserLabel() {
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {
      return;
    }
    if (!session || !sessionUser) return;
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden.find(item => item.name === session.memberName && item.loginId === session.loginId);
    if (!member) return;
    const displayName = nicknamesAreEnabled() && member.nickname ? member.nickname : member.name;
    sessionUser.textContent = `Ingelogd: ${displayName}`;
  }

  function showLoginPopup(message = '') {
    appContainer?.classList.add('app-locked');
    appContainer?.setAttribute('aria-hidden', 'true');
    loginScreen?.classList.remove('hidden');
    registrationScreen?.classList.add('hidden');
    if (loginError) loginError.textContent = message;
    if (loginIdInput) loginIdInput.value = '';
    setTimeout(() => loginIdInput?.focus(), 0);
  }

  function showRegistrationPopup(message = '') {
    appContainer?.classList.add('app-locked');
    appContainer?.setAttribute('aria-hidden', 'true');
    loginScreen?.classList.add('hidden');
    registrationScreen?.classList.remove('hidden');
    if (registrationError) registrationError.textContent = message;
    setTimeout(() => registrationNameInput?.focus(), 0);
  }

  function nextAdminLoginId() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const usedIds = new Set(leden.map(member => String(member.loginId || '').toUpperCase()));
    let number = 1;
    while (usedIds.has(`ADMIN${number}`)) number += 1;
    return `ADMIN${number}`;
  }

  function ensureAdminForExistingInstallation() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    if (leden.length === 0 || leden.some(member => member.isAdmin === true && String(member.loginId || '').startsWith('ADMIN'))) {
      return null;
    }
    const firstMember = leden[0];
    const previousLoginId = firstMember.loginId || '';
    firstMember.isAdmin = true;
    firstMember.loginId = nextAdminLoginId();
    localStorage.setItem('leden', JSON.stringify(leden));
    safeAddLog({
      type: 'admin_id_aangemaakt',
      category: 'admin',
      member: firstMember.name,
      action: 'ADMIN-ID aangemaakt voor bestaande installatie',
      detail: previousLoginId ? `${previousLoginId} → ${firstMember.loginId}` : `Admin-ID: ${firstMember.loginId}`,
      performedBy: firstMember.name,
      performedByLoginId: firstMember.loginId
    });
    return firstMember;
  }

  function logout(message = 'Je bent uitgelogd.') {
    sessionStorage.removeItem('tapinLoginSession');
    clearTimeout(automaticLogoutTimer);
    automaticLogoutTimer = null;
    showLoginPopup(message);
  }

  function scheduleAutomaticLogout(expiresAt) {
    clearTimeout(automaticLogoutTimer);
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      logout('Je sessie is verlopen. Log opnieuw in.');
      return;
    }
    automaticLogoutTimer = setTimeout(
      () => logout('Je sessie is verlopen. Log opnieuw in.'),
      Math.min(remaining, 2147483647)
    );
  }

  function startLoginSession(member) {
    const expiresAt = Date.now() + getSessionTimeoutMinutes() * 60 * 1000;
    sessionStorage.setItem('tapinLoginSession', JSON.stringify({
      memberName: member.name,
      loginId: member.loginId,
      expiresAt
    }));
    if (loginError) loginError.textContent = '';
    showLoggedInApp(member);
    scheduleAutomaticLogout(expiresAt);
    notify(`Welkom ${member.nickname || member.name}!`);
  }

  function initializeLogin() {
    const existingMembers = JSON.parse(localStorage.getItem('leden')) || [];
    if (existingMembers.length === 0) {
      sessionStorage.removeItem('tapinLoginSession');
      showRegistrationPopup();
      return;
    }
    const migratedAdmin = ensureAdminForExistingInstallation();
    const leden = ensureMemberLoginIds();
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {
      sessionStorage.removeItem('tapinLoginSession');
    }

    const member = session && leden.find(item =>
      item.name === session.memberName && item.loginId === session.loginId
    );
    if (member && Number(session.expiresAt) > Date.now()) {
      showLoggedInApp(member);
      scheduleAutomaticLogout(Number(session.expiresAt));
    } else {
      sessionStorage.removeItem('tapinLoginSession');
      const message = migratedAdmin
        ? `${migratedAdmin.name} is beheerder geworden. De nieuwe Admin-ID is ${migratedAdmin.loginId}.`
        : session ? 'Je sessie is verlopen. Log opnieuw in.' : '';
      showLoginPopup(message);
    }
  }

  registrationForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (registrationNameInput?.value || '').trim();
    const pin = (registrationPinInput?.value || '').trim();
    const pinConfirmation = (registrationPinConfirmInput?.value || '').trim();

    if (!name) {
      if (registrationError) registrationError.textContent = 'Vul je naam in.';
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      if (registrationError) registrationError.textContent = 'De pincode moet uit 4 tot 6 cijfers bestaan.';
      return;
    }
    if (pin !== pinConfirmation) {
      if (registrationError) registrationError.textContent = 'De pincodes zijn niet gelijk.';
      return;
    }

    const currentMembers = JSON.parse(localStorage.getItem('leden')) || [];
    if (currentMembers.length > 0) {
      showLoginPopup('TapIn is al geregistreerd. Log in met je Inlog-ID.');
      return;
    }

    const adminMember = {
      name,
      nickname: '',
      amount: 0,
      totalAmount: 0,
      drinks: [],
      favorite: false,
      isAdmin: true,
      loginId: nextAdminLoginId()
    };
    localStorage.setItem('leden', JSON.stringify([adminMember]));
    localStorage.setItem('pinCode', pin);
    localStorage.setItem('loginIdCounter', '1');
    safeAddLog({
      type: 'admin_geregistreerd',
      category: 'admin',
      member: name,
      action: 'Eerste beheerder geregistreerd',
      detail: `Admin-ID: ${adminMember.loginId}`,
      performedBy: name,
      performedByLoginId: adminMember.loginId
    });
    if (registrationError) registrationError.textContent = '';
    startLoginSession(adminMember);
    notify(`Registratie gelukt. Jouw Admin-ID is ${adminMember.loginId}.`);
  });

  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredId = (loginIdInput?.value || '').trim().toUpperCase();
    const leden = ensureMemberLoginIds();
    const member = leden.find(item => String(item.loginId || '').toUpperCase() === enteredId);
    if (!member) {
      if (loginError) loginError.textContent = 'Onbekende inlog-ID.';
      loginIdInput?.select();
      return;
    }
    startLoginSession(member);
  });

  logoutButton?.addEventListener('click', () => logout('Je bent uitgelogd.'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {
      sessionStorage.removeItem('tapinLoginSession');
    }
    if (session && Number(session.expiresAt) <= Date.now()) {
      logout('Je sessie is verlopen. Log opnieuw in.');
    }
  });

  memberFilterButton?.addEventListener('click', () => {
    const willOpen = memberFilterMenu?.classList.contains('hidden');
    memberFilterMenu?.classList.toggle('hidden');
    memberFilterButton.setAttribute('aria-expanded', String(Boolean(willOpen)));
  });

  favoriteFilterCheckbox?.addEventListener('change', () => {
    showFavoritesOnly = favoriteFilterCheckbox.checked;
    updateFilterControls();
    loadLedenList();
    notify(showFavoritesOnly
      ? 'Alleen favoriete leden worden getoond.'
      : 'Alle leden worden weer getoond.');
  });

  nicknamesCheckbox?.addEventListener('change', () => {
    const enabled = nicknamesCheckbox.checked;
    localStorage.setItem('nicknamesEnabled', String(enabled));
    updateFilterControls();
    loadLedenList();
    notify(enabled ? 'Bijnamen zijn ingeschakeld.' : 'Bijnamen zijn uitgeschakeld.');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.member-filter')) {
      memberFilterMenu?.classList.add('hidden');
      memberFilterButton?.setAttribute('aria-expanded', 'false');
    }
  });

  updateFilterControls();

  // --- Drankjeslijst laden ---
  function loadDrankjesList() {
    const drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];
    const frag = document.createDocumentFragment();

    drankjes.forEach(drink => {
      if (!drink?.name) return;
      const li = document.createElement('li');
      li.innerHTML = `
          <span>${drink.name} - €${Number(drink.amount).toFixed(2)}</span>
          <div class="drink-buttons">
            <button type="button" class="remove-btn">-1</button>
            <button type="button" class="add-btn">Voeg Toe</button>
          </div>
        `;
      li.querySelector('.add-btn').addEventListener('click', () => addDrinkToBill(drink.name, Number(drink.amount)));
      li.querySelector('.remove-btn').addEventListener('click', () => removeDrinkFromBill(drink.name, Number(drink.amount)));
      frag.appendChild(li);
    });

    drankjesUl.innerHTML = '';
    drankjesUl.appendChild(frag);
  }


  // --- Drankjeslijst tonen ---
  function showDrankjesLijst(memberName) {
    currentMemberNameSpan.textContent = memberName;
    ledenLijstSection.style.display = 'none';
    drankjesLijstSection.style.display = 'block';
    loadDrankjesList();
    loadDrankjesDetails(memberName);
    updateTotalAmount(memberName);
  }

  function backToLeden() {
    ledenLijstSection.style.display = 'block';
    drankjesLijstSection.style.display = 'none';
  }

  // --- Details voor geselecteerd lid ---
  function loadDrankjesDetails(memberName) {
    drankjesDetails.innerHTML = '';
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden.find(m => m.name === memberName);

    if (!member || !Array.isArray(member.drinks) || member.drinks.length === 0) {
      drankjesDetails.innerHTML = '<p>U heeft momenteel niks open staan!</p>';
      return;
    }

    const detailMap = {};
    for (const d of member.drinks) {
      if (!detailMap[d.name]) detailMap[d.name] = { count: 0, total: 0 };
      detailMap[d.name].count += 1;
      detailMap[d.name].total += Number(d.amount || 0);
    }

    const frag = document.createDocumentFragment();
    Object.entries(detailMap).forEach(([name, info]) => {
      const card = document.createElement('div');
      card.className = 'drink-card';
      card.innerHTML = `
          <span class="drink-name"><strong>${info.count}×</strong> ${name}</span>
          <span class="drink-total">€${info.total.toFixed(2)}</span>
        `;
      frag.appendChild(card);
    });

    drankjesDetails.appendChild(frag);
  }



  function updateTotalAmount(memberName) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden.find(m => m.name === memberName);
    const total = (member?.drinks || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalAmountEl = document.getElementById('totalAmount');
    if (totalAmountEl) totalAmountEl.textContent = `Totaal: €${total.toFixed(2)}`;
  }

  // --- Historische statistieken bijwerken ---
  function updateHistoricalStats(memberName, drinkName, drinkAmount) {
    const key = 'historicalStats';
    const hs = JSON.parse(localStorage.getItem(key)) || { totalSpent: 0, memberStats: {}, drinkStats: {} };

    if (!hs.memberStats[memberName]) hs.memberStats[memberName] = { totalSpent: 0 };
    hs.memberStats[memberName].totalSpent += drinkAmount;
    hs.totalSpent += drinkAmount;
    hs.drinkStats[drinkName] = (hs.drinkStats[drinkName] || 0) + 1;

    localStorage.setItem(key, JSON.stringify(hs));
  }

  // --- Drankje toevoegen ---
  window.addDrinkToBill = function (drinkName, drinkAmount) {

    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const memberName = currentMemberNameSpan.textContent;
    const idx = leden.findIndex(m => m.name === memberName);
    if (idx === -1) return;
  
    const member = leden[idx];
  
    // 🔴 CHECK FIRST (belangrijk!)
    evaluateMemberStatus(member);
  
    if (member.isBlocked) {
      notify(`⛔ ${member.name} is geblokkeerd: limiet van €${getGlobalLimit().toFixed(2)} bereikt`);
      return;
    }

    const drinkObj = {
      name: drinkName,
      amount: Number(drinkAmount || 0)
    };
  
    // 👉 pas hierna toevoegen
    member.totalAmount = Number(member.totalAmount || 0) + Number(drinkAmount || 0);

    if (!Array.isArray(member.drinks)) member.drinks = [];

    member.drinks.push(drinkObj);
    
    leden[idx] = member;
    localStorage.setItem('leden', JSON.stringify(leden));
    
    // 🔥 LOGBOEK TOEVOEGEN (HIER!)
    safeAddLog({
      type: "drankje_toegevoegd",
      member: member.name,
      drink: drinkObj.name,   // 👈 alleen string
      amount: drinkObj.amount, // 👈 apart veld
      message: `${drinkObj.name} toegevoegd aan ${member.name}`
    });
    
    updateHistoricalStats(member.name, drinkName, Number(drinkAmount || 0));
    
    batchNotify(
      `add-${member.name}-${drinkName}`,
      (count) => `+${count} ${drinkName} toegevoegd aan rekening van ${member.name}`
    );
    
    loadDrankjesDetails(member.name);
    updateTotalAmount(member.name);
    sessionStorage.setItem('lastSelectedMember', member.name);
  
    localStorage.setItem("logs", JSON.stringify(logs));
  }

  // --- Drankje verwijderen ---
  window.removeDrinkFromBill = function (drinkName, drinkAmount) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const memberName = currentMemberNameSpan.textContent;
    const idx = leden.findIndex(m => m.name === memberName);
    if (idx === -1) return;
  
    const member = leden[idx];
    if (!Array.isArray(member.drinks) || member.drinks.length === 0) return;
  
    // 🔥 normaliseer (voorkomt match bugs)
    const targetAmount = Number(drinkAmount);
  
    const drinkIndex = member.drinks.findIndex(d =>
      d.name === drinkName &&
      Number(d.amount) === targetAmount
    );
  
    if (drinkIndex === -1) return;
  
    member.drinks.splice(drinkIndex, 1);
    member.totalAmount = Math.max(
      0,
      Number(member.totalAmount || 0) - targetAmount
    );
  
    leden[idx] = member;
    localStorage.setItem('leden', JSON.stringify(leden));
  
    // UI
    loadDrankjesDetails(member.name);
    updateTotalAmount(member.name);
  
    // 🔥 CLEAN LOG (belangrijk voor filters)
    safeAddLog({
      type: "drankje_verwijderd",
      member: member.name,
      drink: drinkName,              // 👈 string
      amount: Number(drinkAmount),   // 👈 nummer
      message: `${drinkName} verwijderd van ${member.name}`
    });
    
  
    batchNotify(
      `remove-${member.name}-${drinkName}`,
      (count) => `-${count} ${drinkName} verwijderd van ${member.name} zijn rekening`
    );
  };


  // --- Betaling bevestigen ---
  if (confirmOrderButton) {
    confirmOrderButton.addEventListener('click', () => {
      if (!confirmationModal) return;
      confirmationModal.classList.add('show');
      confirmationModal.setAttribute('aria-hidden', 'false');
    });
  }

  if (confirmPaymentButton) {
    confirmPaymentButton.addEventListener('click', () => {
      const leden = JSON.parse(localStorage.getItem('leden')) || [];
      const memberName = currentMemberNameSpan.textContent;
      const member = leden.find(m => m.name === memberName);
      if (member) {
        const paidAmount = Number(member.totalAmount || 0);
        member.totalAmount = 0;
        member.drinks = [];
        localStorage.setItem('leden', JSON.stringify(leden));
        safeAddLog({
          type: 'rekening_betaald',
          member: member.name,
          amount: paidAmount,
          action: 'Rekening betaald voor'
        });
      }
      if (confirmationModal) {
        confirmationModal.classList.add('hide');
        setTimeout(() => {
          confirmationModal.classList.remove('show', 'hide');
          confirmationModal.setAttribute('aria-hidden', 'true');
          notify(`Betaling verwerkt voor ${memberName}.`);
          // Terug naar ledenlijst en UI verversen
          backToLeden();
          loadLedenList();
        }, 300);
      }
    });
  }

  if (closeModalButton) {
    closeModalButton.addEventListener('click', () => {
      if (!confirmationModal) return;
      confirmationModal.classList.add('hide');
      setTimeout(() => confirmationModal.classList.remove('show', 'hide'), 300);
    });
  }


  // --- Terugknop ---
  if (backToLedenButton) {
    backToLedenButton.addEventListener('click', () => {
      backToLeden();
      location.reload(); // zorgt voor refresh
    });
  }

  // --- Init ---
  initializeLogin();
  loadLedenList();
});

function openPinPopup(action) {
  pinAction = action; // bv. "clear-bill"
  document.getElementById('pinPopup').classList.add('visible');
}

function closePinPopup() {
  const popup = document.getElementById('pinPopup');
  popup.classList.add('closing');
  setTimeout(() => {
    popup.classList.remove('visible', 'closing');
    document.getElementById('pinInput').value = '';
  }, 350);
}

document.getElementById('cancelPin').addEventListener('click', closePinPopup);

document.getElementById('confirmPin').addEventListener('click', () => {
  const storedPin = localStorage.getItem('pinCode') || '1234';
  const enteredPin = document.getElementById('pinInput').value.trim();

  if (enteredPin === storedPin) {
    if (pinAction === 'clear-bill') {
      window.clearCurrentMemberBill();
    }
    closePinPopup();
    showNotification('De rekening is geleegd!');
  } else {
    window.showNotification?.('❌ Onjuiste pincode');
  }
});

// --- Rekening legen knop ---
const clearBillBtn = document.getElementById('clearBill');
if (clearBillBtn) {
  clearBillBtn.addEventListener('click', () => {
    // open pincode modal, zet context
    pinAction = 'clear-bill';
    openPinPopup('Bevestig met pincode om rekening te legen');
  });
}

// --- Uitvoerder: wis drankjes & totalen voor huidig lid (zonder historiek aanpassen) ---
function clearCurrentMemberBill() {
  const leden = JSON.parse(localStorage.getItem('leden')) || [];
  const memberName = (document.getElementById('currentMemberName')?.textContent || '').trim();
  const idx = leden.findIndex(m => m.name === memberName);
  if (idx === -1) return;

  // niet historiek wijzigen — enkel huidige rekening leegmaken
  leden[idx].totalAmount = 0;
  leden[idx].drinks = [];
  localStorage.setItem('leden', JSON.stringify(leden));

  // UI bijwerken (zonder reload)
  if (typeof window.showNotification === 'function') {
    window.showNotification(`Rekening van ${memberName} geleegd.`);
  }
  // herbouw details + totaal
  loadDrankjesDetails(memberName);
  updateTotalAmount(memberName);
}
