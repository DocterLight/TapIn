(function enforceAdminAccess() {
  let session = null;
  try {
    session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
  } catch (_) {}
  const members = JSON.parse(localStorage.getItem('leden') || '[]');
  const admin = members.find(member =>
    member.isAdmin === true &&
    member.name === session?.memberName &&
    member.loginId === session?.loginId &&
    String(member.loginId || '').toUpperCase().startsWith('ADMIN')
  );
  if (!admin || Number(session?.expiresAt) <= Date.now()) {
    sessionStorage.removeItem('tapinLoginSession');
    window.location.replace('index.html');
    return;
  }
  document.documentElement.classList.add('admin-authorized');
})();

document.addEventListener('DOMContentLoaded', () => {
  // === Service Worker ===
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker geregistreerd:', reg.scope))
        .catch(err => console.log('Service Worker registratie mislukt:', err));
    });
  }


  function addLog(entry) {
    const logs = JSON.parse(localStorage.getItem("logs")) || [];
    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {}

    logs.push({
      ...entry,
      performedBy: entry.performedBy || session?.memberName || 'Beheerder',
      performedByLoginId: entry.performedByLoginId || session?.loginId || '',
      timestamp: Date.now()
    });

    localStorage.setItem("logs", JSON.stringify(logs));
  }

  // === Elementen ophalen ===
  const backButton = document.getElementById('backButton');
  const statisticsButton = document.getElementById('statisticsButton');

  const addMemberForm = document.getElementById('addMemberForm');
  const memberNameInput = document.getElementById('memberName');
  const memberNicknameInput = document.getElementById('memberNickname');

  const addDrinkForm = document.getElementById('addDrinkForm');
  const drinkNameInput = document.getElementById('drinkName');
  const drinkAmountInput = document.getElementById('drinkAmount');

  const ledenToRemove = document.getElementById('ledenToRemove');
  const drankjesToRemove = document.getElementById('drankjesToRemove');

  const enableFixedLogoBtn = document.getElementById('enable-fixed-logo');

  document.getElementById("logFilter")?.addEventListener("change", loadLogboek);


  // 🎯 Pincode popup: support zowel #pinPopup als #pincodePopup (bestaande HTML)
  const pinModal = document.getElementById('pinPopup') || document.getElementById('pincodePopup');
  const popupPincodeInput = document.getElementById('popupPincodeInput');
  const confirmPopupButton = document.getElementById('confirmPopupButton');
  const cancelPopupButton = document.getElementById('cancelPopupButton');
  const popupTitle = pinModal ? pinModal.querySelector('.popup-content h2') : null;
  const nicknamePopup = document.getElementById('nicknamePopup');
  const nicknamePopupTitle = document.getElementById('nicknamePopupTitle');
  const nicknamePopupInput = document.getElementById('nicknamePopupInput');
  const confirmNicknameButton = document.getElementById('confirmNicknameButton');
  const cancelNicknameButton = document.getElementById('cancelNicknameButton');

  const notificationPopup = document.getElementById('notificationPopup');
  const notificationMessage = document.getElementById('notificationMessage');

  const toggleThemeBtn = document.getElementById('toggle-theme');

  // Layout tab elementen
  const logoUpload = document.getElementById('logo-upload');
  const bgUpload = document.getElementById('bg-upload');
  const previewLogo = document.getElementById('preview-logo');
  const fullscreenPreview = document.getElementById('fullscreen-preview');
  const togglePreviewBtn = document.getElementById('toggle-preview');
  const saveLayoutBtn = document.getElementById('save-layout');
  const resetBtn = document.getElementById('reset-layout');

  // Reset-bevestiging popup
  const resetPopup = document.getElementById('resetPopup');
  const confirmResetButton = document.getElementById('confirmResetButton');
  const cancelResetButton = document.getElementById('cancelResetButton');

  // Pincode tab (nieuwe pincode formulier)
  const savePinBtn = document.getElementById('save-pin');
  const pinInput = document.getElementById('pin-code'); // nieuwe pincode veld
  const globalLimitForm = document.getElementById('globalLimitForm');
  const globalLimitInput = document.getElementById('globalLimitInput');
  const sessionTimeoutForm = document.getElementById('sessionTimeoutForm');
  const sessionTimeoutInput = document.getElementById('sessionTimeoutInput');
  const loginIdList = document.getElementById('loginIdList');
  const loginIdSection = document.getElementById('loginIdSection');
  const unlockLoginIdsButton = document.getElementById('unlockLoginIdsButton');

  // PWA
  const installButton = document.getElementById('installButton');

  const DEFAULT_PIN = '0000';

  // State voor pin-popup flow
  let actionContext = 'delete';      // 'delete' | 'change'
  let currentType = null;            // 'lid' | 'drankje' (bij delete)
  let currentName = null;            // item naam (bij delete)
  let pendingNewPin = null;          // tijdelijke opslag nieuwe pincode (bij change)
  let pendingGlobalLimit = null;     // tijdelijke opslag bedraglimiet
  let pendingWhitelistIndex = null;
  let pendingSessionTimeout = null;
  let logbookUnlocked = false;
  let loginIdsUnlocked = false;
  let pendingAdminRoleIndex = null;
  let pendingAdminRoleEnabled = null;
  let currentNicknameIndex = null;

  if (globalLimitInput) {
    const savedLimit = Number(localStorage.getItem('globalLimit'));
    globalLimitInput.value = Number.isFinite(savedLimit) && savedLimit > 0 ? savedLimit : 25;
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

  function nextAdminLoginId(leden) {
    const usedIds = new Set(leden.map(member => String(member.loginId || '').toUpperCase()));
    let number = 1;
    while (usedIds.has(`ADMIN${number}`)) number += 1;
    return `ADMIN${number}`;
  }

  function nextRegularLoginId(member, leden) {
    const usedIds = new Set(
      leden
        .filter(item => item !== member)
        .map(item => String(item.loginId || '').toUpperCase())
        .filter(Boolean)
    );
    let counter = Math.max(1, Number(localStorage.getItem('loginIdCounter')) || 1);
    let candidate;
    do {
      candidate = `${loginIdBase(member.name)}${counter}`;
      counter += 1;
    } while (usedIds.has(candidate));
    localStorage.setItem('loginIdCounter', String(counter));
    return candidate;
  }

  function applyAdminRoleChange(index, enabled) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden[index];
    if (!member) return false;

    let session = null;
    try {
      session = JSON.parse(sessionStorage.getItem('tapinLoginSession') || 'null');
    } catch (_) {}

    if (!enabled) {
      const adminCount = leden.filter(item => item.isAdmin === true).length;
      if (adminCount <= 1) {
        showNotification('De laatste beheerder kan niet worden verwijderd.');
        return false;
      }
    }

    const previousLoginId = member.loginId;
    const isCurrentAdmin = !enabled && session?.loginId === previousLoginId;
    member.isAdmin = enabled;
    member.loginId = enabled
      ? nextAdminLoginId(leden)
      : nextRegularLoginId(member, leden);
    localStorage.setItem('leden', JSON.stringify(leden));

    addLog({
      type: enabled ? 'admin_id_toegewezen' : 'admin_id_ingetrokken',
      category: 'admin',
      member: member.name,
      action: enabled ? 'Adminrechten toegewezen aan' : 'Adminrechten ingetrokken van',
      detail: `${previousLoginId} → ${member.loginId}`
    });
    loadAdminAccessSettings();
    showNotification(enabled
      ? `${member.name} is nu beheerder met ID ${member.loginId}.`
      : `${member.name} is geen beheerder meer en heeft ID ${member.loginId}.`);
    if (isCurrentAdmin) {
      sessionStorage.removeItem('tapinLoginSession');
      setTimeout(() => window.location.replace('index.html'), 1200);
    }
    return true;
  }

  function loadAdminAccessSettings() {
    const savedTimeout = Number(localStorage.getItem('sessionTimeoutMinutes'));
    if (sessionTimeoutInput) {
      sessionTimeoutInput.value = Number.isFinite(savedTimeout) && savedTimeout >= 1 ? savedTimeout : 30;
    }
    if (!loginIdList) return;

    const leden = ensureMemberLoginIds();
    loginIdList.innerHTML = '';
    const adminCount = leden.filter(member => member.isAdmin === true).length;

    leden.forEach((member, index) => {
      const li = document.createElement('li');
      li.className = 'login-id-row';
      const name = document.createElement('span');
      name.textContent = member.nickname ? `${member.nickname} (${member.name})` : member.name;
      const id = document.createElement('strong');
      id.textContent = member.loginId;
      const actions = document.createElement('div');
      actions.className = 'login-id-actions';
      const adminButton = document.createElement('button');
      adminButton.type = 'button';
      adminButton.className = member.isAdmin ? 'admin-role-button is-admin' : 'admin-role-button';
      adminButton.textContent = member.isAdmin ? 'Admin intrekken' : 'Maak admin';
      adminButton.disabled = member.isAdmin && adminCount <= 1;
      if (adminButton.disabled) {
        adminButton.title = 'De laatste beheerder kan niet worden verwijderd';
      }
      adminButton.addEventListener('click', () => {
        pendingAdminRoleIndex = index;
        pendingAdminRoleEnabled = member.isAdmin !== true;
        actionContext = 'adminRole';
        openPinPopup(member.isAdmin
          ? `Bevestig het intrekken van adminrechten voor ${member.name}`
          : `Bevestig adminrechten voor ${member.name}`);
      });
      actions.append(id, adminButton);
      li.append(name, actions);
      loginIdList.appendChild(li);
    });
  }

  // === Dark Mode bij laden ===
  const headerLogo = document.getElementById('headerLogo');

  // Functie die logo wisselt
  function updateLogo() {
    const headerLogo = document.getElementById('headerLogo');
    if (!headerLogo) return;

    const fixedLogoEnabled = localStorage.getItem('fixedLogoEnabled') === 'true';
    const customLogo = localStorage.getItem('customLogo');
    const customLogoEnabled = localStorage.getItem('customLogoEnabled') === 'true';

    if (fixedLogoEnabled) {
      headerLogo.src = 'assets/images/logo-Custom.jpg';
      return;
    }
    if (customLogo && customLogoEnabled) {
      headerLogo.src = customLogo;
      return;
    }
    headerLogo.src = document.body.classList.contains('dark-mode')
      ? 'assets/images/logo-dark.png'
      : 'assets/images/logo-light.png';
  }


  // === Dark Mode bij laden ===
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  updateLogo(); // meteen juiste logo tonen

  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
      updateLogo(); // logo switchen
    });
  }

  // === Notificatie helper met animatie (visible -> closing) ===
  function showNotification(message) {
    if (!notificationPopup || !notificationMessage) {
      alert(message);
      return;
    }
    notificationMessage.textContent = message;

    // reset animaties
    notificationPopup.classList.remove('closing');
    void notificationPopup.offsetWidth; // reflow

    notificationPopup.classList.add('visible');

    setTimeout(() => {
      notificationPopup.classList.remove('visible');
      notificationPopup.classList.add('closing');
      setTimeout(() => {
        notificationPopup.classList.remove('closing');
      }, 500); // match envelopeClose duur
    }, 3000);
  }

  // === Pincode validatie (verwijderen of wijzigen) ===
  function validatePincode() {
    const storedPin = localStorage.getItem('pinCode') || DEFAULT_PIN;
    const inputPin = (popupPincodeInput?.value || '').trim();

    if (actionContext === 'delete') {
      if (inputPin === storedPin) {
        if (currentType === 'lid') removeLid(currentName);
        else if (currentType === 'drankje') removeDrink(currentName);
        closePinPopup(true);
        showNotification('Succesvol verwijderd!');
      } else {
        showNotification('Onjuiste pincode. Probeer opnieuw.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'change') {
      if (inputPin === storedPin) {
        localStorage.setItem('pinCode', pendingNewPin);
        addLog({
          type: 'admin_pincode_gewijzigd',
          category: 'admin',
          member: 'adminpaneel',
          action: 'Pincode succesvol gewijzigd voor'
        });
        closePinPopup(true);
        pendingNewPin = null;
        showNotification('Pincode succesvol gewijzigd!');
        if (pinInput) pinInput.value = '';
      } else {
        showNotification('Huidige pincode onjuist. Wijzigen afgebroken.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'limit') {
      if (inputPin === storedPin && pendingGlobalLimit !== null) {
        const previousLimit = Number(localStorage.getItem('globalLimit')) || 25;
        localStorage.setItem('globalLimit', String(pendingGlobalLimit));
        addLog({
          type: 'admin_limiet_gewijzigd',
          category: 'admin',
          member: 'alle niet-whitelistleden',
          action: 'Bedraglimiet gewijzigd',
          detail: `€${previousLimit.toFixed(2)} → €${pendingGlobalLimit.toFixed(2)}`
        });
        if (globalLimitInput) globalLimitInput.value = pendingGlobalLimit;
        closePinPopup(true);
        showNotification(`Bedraglimiet gewijzigd naar €${pendingGlobalLimit.toFixed(2)}.`);
        pendingGlobalLimit = null;
      } else {
        showNotification('Onjuiste pincode. Limiet niet gewijzigd.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'whitelist') {
      if (inputPin === storedPin && pendingWhitelistIndex !== null) {
        applyWhitelistChange(pendingWhitelistIndex);
        closePinPopup(true);
        showNotification('Whitelist succesvol gewijzigd.');
      } else {
        showNotification('Onjuiste pincode. Whitelist niet gewijzigd.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'sessionTimeout') {
      if (inputPin === storedPin && pendingSessionTimeout !== null) {
        const previousTimeout = Number(localStorage.getItem('sessionTimeoutMinutes')) || 30;
        localStorage.setItem('sessionTimeoutMinutes', String(pendingSessionTimeout));
        addLog({
          type: 'admin_uitlogtijd_gewijzigd',
          category: 'admin',
          member: 'inlogscherm',
          action: 'Automatische uitlogtijd gewijzigd',
          detail: `${previousTimeout} → ${pendingSessionTimeout} minuten`
        });
        if (sessionTimeoutInput) sessionTimeoutInput.value = pendingSessionTimeout;
        const savedTimeout = pendingSessionTimeout;
        pendingSessionTimeout = null;
        closePinPopup(true);
        showNotification(`Automatische uitlogtijd ingesteld op ${savedTimeout} minuten.`);
      } else {
        showNotification('Onjuiste pincode. Uitlogtijd niet gewijzigd.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'openLogbook') {
      if (inputPin === storedPin) {
        closePinPopup(true);
        openProtectedLogbook();
      } else {
        showNotification('Onjuiste pincode. Logboek blijft vergrendeld.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'unlockLoginIds') {
      if (inputPin === storedPin) {
        loginIdsUnlocked = true;
        loginIdSection?.classList.remove('is-locked');
        closePinPopup(true);
        showNotification("Inlog-ID's zijn ontgrendeld.");
      } else {
        showNotification("Onjuiste pincode. Inlog-ID's blijven vergrendeld.");
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }

    if (actionContext === 'adminRole') {
      if (inputPin === storedPin && pendingAdminRoleIndex !== null && pendingAdminRoleEnabled !== null) {
        applyAdminRoleChange(pendingAdminRoleIndex, pendingAdminRoleEnabled);
        pendingAdminRoleIndex = null;
        pendingAdminRoleEnabled = null;
        closePinPopup(true);
      } else {
        showNotification('Onjuiste pincode. Adminrechten zijn niet gewijzigd.');
        if (popupPincodeInput) popupPincodeInput.value = '';
      }
      return;
    }
  }


  function openPinPopup(title = 'Pincode') {
    if (!pinModal) {
      // Fallback voor wanneer popup niet bestaat
      const direct = prompt(title + ':');
      if (direct !== null) {
        if (popupPincodeInput) popupPincodeInput.value = direct;
        validatePincode();
      }
      return;
    }
    if (popupTitle) popupTitle.textContent = title;

    // reset closing-state en toon (zodat CSS modalIn speelt)
    pinModal.classList.remove('closing');
    pinModal.classList.add('visible');

    if (popupPincodeInput) {
      popupPincodeInput.value = '';
      popupPincodeInput.focus();
    }
  }

  if (actionContext === 'enableFixedLogo') {
    if (inputPin === storedPin) {
      localStorage.setItem('fixedLogoEnabled', 'true');
      closePinPopup(true);
      updateLogo();
      showNotification('Alternatief logo geactiveerd!');
    } else {
      showNotification('Onjuiste pincode. Probeer opnieuw.');
      if (popupPincodeInput) popupPincodeInput.value = '';
    }
    return;
  }

  function closePinPopup(withAnimation = false) {
    if (!pinModal) return;

    if (withAnimation) {
      pinModal.classList.add('closing');
      setTimeout(() => {
        pinModal.classList.remove('closing', 'visible');
      }, 500); // match envelopeClose
    } else {
      pinModal.classList.remove('visible');
    }

    // herstel default titel & state
    if (popupTitle) popupTitle.textContent = 'Voer pincode in';
    actionContext = 'delete';
    currentType = null;
    currentName = null;
    pendingWhitelistIndex = null;
    pendingAdminRoleIndex = null;
    pendingAdminRoleEnabled = null;
  }

  // Maak promptForPincode globaal (verwijder-flow)
  window.promptForPincode = function (type, name) {
    actionContext = 'delete';
    currentType = type;
    currentName = name;
    openPinPopup('Bevestig met pincode');
  };

  function openProtectedLogbook() {
    document.querySelectorAll('.sub-tab').forEach(tab => {
      const isLogbook = tab.dataset.tab === 'logboek';
      tab.classList.toggle('active', isLogbook);
      tab.setAttribute('aria-selected', String(isLogbook));
    });
    document.querySelectorAll('.sub-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('logboek')?.classList.add('active');
    window.currentLogFilter = 'all';
    loadLogboek();
    logbookUnlocked = false;
  }

  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (tab.dataset.tab !== 'logboek' || logbookUnlocked) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      actionContext = 'openLogbook';
      openPinPopup('Voer de pincode in om het logboek te openen');
    }, true);
  });

  unlockLoginIdsButton?.addEventListener('click', () => {
    if (loginIdsUnlocked) return;
    actionContext = 'unlockLoginIds';
    openPinPopup("Voer de pincode in om de Inlog-ID's te bekijken");
  });

  // === Pincode wijzigen: eerst huidige pincode vragen ===
  if (savePinBtn) {
    savePinBtn.addEventListener('click', () => {
      const newPin = (pinInput?.value || '').trim();

      if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
        showNotification('Nieuwe pincode moet uit minimaal 4 cijfers bestaan.');
        return;
      }
      pendingNewPin = newPin;
      actionContext = 'change';
      openPinPopup('Voer je huidige pincode in');
    });
  }

  // === Popup events ===
  if (popupPincodeInput) {
    popupPincodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); validatePincode(); }
    });
  }
  if (confirmPopupButton) confirmPopupButton.addEventListener('click', validatePincode);
  if (cancelPopupButton) cancelPopupButton.addEventListener('click', () => closePinPopup(true));

  // === Leden ===
  function loadLedenToRemove() {
    if (!ledenToRemove) return;
    ledenToRemove.innerHTML = '';

    const leden = JSON.parse(localStorage.getItem('leden')) || [];

    leden.forEach((member, index) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'member-name';
      name.textContent = member.nickname
        ? `${member.nickname} (${member.name})`
        : member.name;

      const actions = document.createElement('div');
      actions.className = 'member-actions';

      const favoriteButton = document.createElement('button');
      const isFavorite = member.favorite === true;
      favoriteButton.type = 'button';
      favoriteButton.className = `favorite-button${isFavorite ? ' is-favorite' : ''}`;
      favoriteButton.textContent = isFavorite ? '★' : '☆';
      favoriteButton.title = isFavorite ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten';
      favoriteButton.setAttribute('aria-label', `${favoriteButton.title}: ${member.name}`);
      favoriteButton.setAttribute('aria-pressed', String(isFavorite));
      favoriteButton.addEventListener('click', () => toggleFavorite(index));

      const nicknameButton = document.createElement('button');
      nicknameButton.type = 'button';
      nicknameButton.textContent = 'Bijnaam';
      nicknameButton.title = member.nickname ? 'Wijzig bijnaam' : 'Voeg bijnaam toe';
      nicknameButton.addEventListener('click', () => editNickname(index));

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Verwijder';
      removeButton.addEventListener('click', () => window.promptForPincode('lid', member.name));

      actions.append(favoriteButton, nicknameButton, removeButton);
      li.append(name, actions);
      ledenToRemove.appendChild(li);
    });
  }

  globalLimitForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newLimit = Number(globalLimitInput?.value);

    if (!Number.isFinite(newLimit) || newLimit <= 0) {
      showNotification('Voer een geldige bedraglimiet hoger dan €0 in.');
      return;
    }

    pendingGlobalLimit = Math.round(newLimit * 100) / 100;
    actionContext = 'limit';
    openPinPopup('Bevestig de nieuwe bedraglimiet met je pincode');
  });

  sessionTimeoutForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const minutes = Number(sessionTimeoutInput?.value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      showNotification('Voer een uitlogtijd tussen 1 en 1440 minuten in.');
      return;
    }
    pendingSessionTimeout = minutes;
    actionContext = 'sessionTimeout';
    openPinPopup('Bevestig de nieuwe uitlogtijd met je pincode');
  });

  function toggleFavorite(index) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden[index];
    if (!member) return;

    member.favorite = member.favorite !== true;
    localStorage.setItem('leden', JSON.stringify(leden));
    loadLedenToRemove();
    showNotification(member.favorite
      ? `${member.name} is toegevoegd aan favorieten.`
      : `${member.name} is verwijderd uit favorieten.`);
  }

  function editNickname(index) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden[index];
    if (!member) return;

    currentNicknameIndex = index;
    if (nicknamePopupTitle) nicknamePopupTitle.textContent = `Bijnaam voor ${member.name}`;
    if (nicknamePopupInput) nicknamePopupInput.value = member.nickname || '';
    nicknamePopup?.classList.remove('closing');
    nicknamePopup?.classList.add('visible');
    setTimeout(() => nicknamePopupInput?.focus(), 0);
  }

  function closeNicknamePopup() {
    if (!nicknamePopup) return;
    nicknamePopup.classList.remove('visible');
    currentNicknameIndex = null;
    if (nicknamePopupInput) nicknamePopupInput.value = '';
  }

  function saveNickname() {
    if (currentNicknameIndex === null) return;
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden[currentNicknameIndex];
    if (!member) {
      closeNicknamePopup();
      return;
    }

    const previousNickname = member.nickname || '';
    member.nickname = (nicknamePopupInput?.value || '').trim();
    localStorage.setItem('leden', JSON.stringify(leden));
    const nicknameLogType = !member.nickname
      ? 'lid_bijnaam_verwijderd'
      : previousNickname
        ? 'lid_bijnaam_gewijzigd'
        : 'lid_bijnaam_toegevoegd';
    addLog({
      type: nicknameLogType,
      member: member.name,
      action: !member.nickname
        ? 'Bijnaam verwijderd van'
        : previousNickname
          ? 'Bijnaam gewijzigd voor'
          : 'Bijnaam toegevoegd voor',
      detail: member.nickname
        ? `Bijnaam: ${member.nickname}${previousNickname ? ` (was: ${previousNickname})` : ''}`
        : `Verwijderd: ${previousNickname}`
    });
    closeNicknamePopup();
    loadLedenToRemove();
    showNotification(member.nickname
      ? `Bijnaam opgeslagen als ${member.nickname}.`
      : `Bijnaam van ${member.name} verwijderd.`);
  }

  confirmNicknameButton?.addEventListener('click', saveNickname);
  cancelNicknameButton?.addEventListener('click', closeNicknamePopup);
  nicknamePopupInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNickname();
    }
    if (e.key === 'Escape') closeNicknamePopup();
  });

  function removeLid(name) {
    let leden = JSON.parse(localStorage.getItem('leden')) || [];

    leden = leden.filter(member => member.name !== name);

    localStorage.setItem('leden', JSON.stringify(leden));

    addLog({
      type: "lid_verwijderd",
      name
    });

    loadLedenToRemove();
  }

  // === Drankjes ===
  function loadDrankjesToRemove() {
    if (!drankjesToRemove) return;
    drankjesToRemove.innerHTML = '';
    const drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];
    drankjes.forEach((drink, index) => {
      const isFirst = index === 0;
      const isLast = index === drankjes.length - 1;
      const safeName = drink.name.replace(/'/g, "\\'");
      const li = document.createElement('li');
      li.setAttribute('data-index', index);
      li.setAttribute('draggable', 'true'); // je huidige drag&drop kan gewoon blijven
      li.innerHTML = `
            <span>${drink.name} - €${parseFloat(drink.amount).toFixed(2)}</span>
            <div>
              <button class="reorder-btn" ${isFirst ? 'disabled' : ''} onclick="moveDrink(${index}, -1)" title="Omhoog">▲</button>
              <button class="reorder-btn" ${isLast ? 'disabled' : ''} onclick="moveDrink(${index}, 1)" title="Omlaag">▼</button>
              <button onclick="promptForPincode('drankje', '${safeName}')">Verwijder</button>
            </div>
          `;
      // drag-events blijven werken
      li.addEventListener('dragstart', dragStart);
      li.addEventListener('dragover', dragOver);
      li.addEventListener('drop', dropItem);

      drankjesToRemove.appendChild(li);
    });
  }

  function removeDrink(name) {
    let drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];
    drankjes = drankjes.filter(drink => drink.name !== name);
    localStorage.setItem('drankjes', JSON.stringify(drankjes));
    loadDrankjesToRemove();
  }

  function dragStart(e) { e.dataTransfer.setData('text/plain', e.currentTarget.dataset.index); }
  function dragOver(e) { e.preventDefault(); }
  function dropItem(e) {
    e.preventDefault();
    const target = e.currentTarget;
    const draggedIndex = e.dataTransfer.getData('text/plain');
    const targetIndex = target.dataset.index;
    if (draggedIndex === targetIndex) return;
    const drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];
    const draggedItem = drankjes[draggedIndex];
    drankjes.splice(draggedIndex, 1);
    drankjes.splice(targetIndex, 0, draggedItem);
    localStorage.setItem('drankjes', JSON.stringify(drankjes));
    loadDrankjesToRemove();
  }

  window.moveDrink = function (index, direction) {
    const drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= drankjes.length) return;

    [drankjes[index], drankjes[newIndex]] = [drankjes[newIndex], drankjes[index]];
    localStorage.setItem('drankjes', JSON.stringify(drankjes));
    loadDrankjesToRemove();
  };

  // === Events voor formulieren en navigatie ===
  if (backButton) backButton.addEventListener('click', () => window.location.href = 'index.html');
  if (statisticsButton) statisticsButton.addEventListener('click', () => window.location.href = 'statistics.html');
  if (addMemberForm) {
    addMemberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const memberName = (memberNameInput?.value || '').trim();
      const memberNickname = (memberNicknameInput?.value || '').trim();
      if (memberName) {
        const leden = JSON.parse(localStorage.getItem('leden')) || [];
        leden.push({
          name: memberName,
          nickname: memberNickname,
          amount: 0,
          favorite: false
        });

        addLog({
          type: "lid_toegevoegd",
          name: memberName,
          detail: memberNickname ? `Bijnaam: ${memberNickname}` : ''
        });
        localStorage.setItem('leden', JSON.stringify(leden));
        ensureMemberLoginIds();
        if (memberNameInput) memberNameInput.value = '';
        if (memberNicknameInput) memberNicknameInput.value = '';
        loadLedenToRemove();
        showNotification('Nieuw lid toegevoegd!');
      } else {
        showNotification('Voer een geldige naam in.');
      }
    });
  }


  if (addDrinkForm) {
    addDrinkForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const drinkName = (drinkNameInput?.value || '').trim();
      const amountText = (drinkAmountInput?.value || '').trim();
      const drinkAmount = parseFloat(amountText);

      if (drinkName && !isNaN(drinkAmount) && drinkAmount >= 0) {
        const drankjes = JSON.parse(localStorage.getItem('drankjes')) || [];

        drankjes.push({ name: drinkName, amount: drinkAmount });
        localStorage.setItem('drankjes', JSON.stringify(drankjes));

        // 🆕 LOGBOEK REGEL
        addLog({
          type: "drink_added",
          name: drinkName,
          amount: drinkAmount
        });

        if (drinkNameInput) drinkNameInput.value = '';
        if (drinkAmountInput) drinkAmountInput.value = '';

        loadDrankjesToRemove();
        showNotification('Nieuw drankje toegevoegd!');
      } else {
        showNotification('Voer een geldige naam en bedrag in.');
      }
    });
  }

  // === Subtabs ===
  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {

      document.querySelectorAll('.sub-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.sub-tab-content').forEach(c => {
        c.classList.remove('active');
      });

      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');

      // 🔥 BELANGRIJK: whitelist tab hook
      if (btn.dataset.tab === 'whitelist') {
        loadAdminDashboard();
      }
      if (btn.dataset.tab === 'adminSettings') {
        loadAdminAccessSettings();
      }

    });
  });



  // === Layout: helper om file in te lezen ===
  function handleFileUpload(input, onLoad) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onLoad(e.target.result);
    reader.readAsDataURL(file);
  }

  // Logo upload → direct tonen + opslaan
  if (logoUpload) {
    logoUpload.addEventListener('change', () => {
      handleFileUpload(logoUpload, (dataUrl) => {
        if (previewLogo) {
          previewLogo.src = dataUrl;
          previewLogo.style.display = 'block';
        }
        const headerLogo = document.getElementById('headerLogo');
        if (headerLogo) headerLogo.src = dataUrl;
        localStorage.setItem('customLogo', dataUrl);
        showNotification('Logo opgeslagen.');
      });
    });
  }

  // Achtergrond upload → direct body background + opslaan
  if (bgUpload) {
    bgUpload.addEventListener('change', () => {
      handleFileUpload(bgUpload, (dataUrl) => {
        document.body.style.backgroundImage = `url(${dataUrl})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';

        if (fullscreenPreview) {
          fullscreenPreview.style.backgroundImage = `url(${dataUrl})`;
          fullscreenPreview.style.backgroundSize = 'cover';
          fullscreenPreview.style.backgroundPosition = 'center';
        }
        localStorage.setItem('customBackground', dataUrl);
        showNotification('Achtergrond opgeslagen.');
      });
    });
  }

  // Preview aan/uit
  if (togglePreviewBtn && fullscreenPreview) {
    togglePreviewBtn.addEventListener('click', () => {
      const isHidden = fullscreenPreview.style.display === 'none' || !fullscreenPreview.style.display;
      fullscreenPreview.style.display = isHidden ? 'flex' : 'none';
      togglePreviewBtn.textContent = isHidden ? 'Preview uit' : 'Preview aan';
    });
  }

  // "Opslaan" knop is informatief (upload slaat al op)
  if (saveLayoutBtn) {
    saveLayoutBtn.addEventListener('click', () => showNotification('Layout opgeslagen!'));
  }

  // === Reset met bevestiging ===
  function doReset() {
    localStorage.removeItem('customLogo');
    localStorage.removeItem('customBackground');
    localStorage.removeItem('pinCode');
    localStorage.removeItem('darkMode'); // ← 'w' weggehaald
    localStorage.removeItem('fixedLogoEnabled');
    localStorage.removeItem('customLogoEnabled');
    localStorage.removeItem('globalLimit');
    localStorage.removeItem('nicknamesEnabled');
    localStorage.removeItem('sessionTimeoutMinutes');

    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo) headerLogo.src = 'assets/images/logo-light.png';
    if (previewLogo) {
      previewLogo.src = '';
      previewLogo.style.display = 'none';
    }
    if (fullscreenPreview) {
      fullscreenPreview.style.backgroundImage = 'none';
      fullscreenPreview.style.display = 'none';
    }

    document.body.style.backgroundImage = 'none';
    document.body.classList.remove('dark-mode');

    showNotification(`Alles is gereset naar standaard waarden! (pincode = ${DEFAULT_PIN})`);
    location.reload();
  }

  // Open reset popup (center + animatie)
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (resetPopup) {
        resetPopup.classList.remove("closing");
        resetPopup.classList.add("visible");
      } else {
        if (confirm("Weet je zeker dat je alles wilt resetten naar standaard?")) doReset();
      }
    });
  }

  // Sluit zonder reset (speel closing animatie)
  if (cancelResetButton) {
    cancelResetButton.addEventListener("click", () => {
      if (!resetPopup) return;
      resetPopup.classList.add("closing");
      setTimeout(() => {
        resetPopup.classList.remove("closing", "visible");
      }, 500);
    });
  }

  // Bevestig reset (speel animatie, dán resetten)
  if (confirmResetButton) {
    confirmResetButton.addEventListener("click", () => {
      if (!resetPopup) { doReset(); return; }
      resetPopup.classList.add("closing");
      setTimeout(() => {
        resetPopup.classList.remove("closing", "visible");
        doReset();
      }, 300);
    });
  }

  // === Bij laden: opgeslagen waarden toepassen ===
  (function applySavedAssets() {
    const savedLogo = localStorage.getItem('customLogo');
    const savedBg = localStorage.getItem('customBackground');
    const headerLogo = document.getElementById('headerLogo');

    if (savedLogo) {
      if (previewLogo) {
        previewLogo.src = savedLogo;
        previewLogo.style.display = 'block';
      }
      if (headerLogo) headerLogo.src = savedLogo;
    }

    if (savedBg) {
      document.body.style.backgroundImage = `url(${savedBg})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';

      if (fullscreenPreview) {
        fullscreenPreview.style.backgroundImage = `url(${savedBg})`;
        fullscreenPreview.style.backgroundSize = 'cover';
        fullscreenPreview.style.backgroundPosition = 'center';
        if (togglePreviewBtn) togglePreviewBtn.textContent = 'Preview aan';
        fullscreenPreview.style.display = 'none';
      }
    }
  })();

  function applyWhitelistChange(index) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const member = leden[index];
    if (!member) return;

    const newStatus = !member.exempt;
    member.exempt = newStatus;
    localStorage.setItem('leden', JSON.stringify(leden));

    addLog({
      type: newStatus ? "whitelist_ingeschakeld" : "whitelist_uitgeschakeld",
      category: "admin",
      member: member.name,
      action: newStatus ? "Toegevoegd aan whitelist:" : "Verwijderd uit whitelist:"
    });

    loadAdminDashboard();
  }

  window.toggleWhitelist = function (index) {
    pendingWhitelistIndex = index;
    loadAdminDashboard();
    actionContext = 'whitelist';
    openPinPopup('Bevestig de whitelistwijziging met je pincode');
  };
  

  // === Startlijsten ===
  loadLedenToRemove();
  loadDrankjesToRemove();
  function loadAdminDashboard() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    const container = document.getElementById('adminList');

    if (!container) return;

    container.innerHTML = '';

    leden.forEach((member, index) => {

      const isWhitelisted = member.exempt === true;

      const statusClass = isWhitelisted
        ? "status-whitelist"
        : "status-limited";

      const statusIcon = isWhitelisted ? "🟢🔓" : "🟡🔒";

      const statusText = isWhitelisted
        ? "WHITELIST"
        : "LIMIET ACTIEF";

      const card = document.createElement('div');
      card.className = 'admin-card';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;">
          <strong>${member.name}</strong>
          <span class="${statusClass}">
  ${statusIcon} ${statusText}
</span>
        </div>
  
        <label style="display:block;margin-top:10px;">
          <input type="checkbox" ${member.exempt ? "checked" : ""}
            onchange="toggleWhitelist(${index})">
          Whitelist (onbeperkt)
        </label>
  
        <div style="margin-top:8px;">
          €${Number(member.totalAmount || 0).toFixed(2)}
        </div>
      `;

      container.appendChild(card);
    });
  }
});

function escapeLogText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function loadLogboek() {
  const logList = document.getElementById("logList");
  if (!logList) return;

  const filter = window.currentLogFilter || "all";
  const logs = JSON.parse(localStorage.getItem("logs")) || [];

  logList.innerHTML = "";

  const filtered = logs.slice().reverse().filter(log => {
    if (filter === "all") return true;

    if (filter === "lid") {
      return log.type.includes("lid");
    }

    if (filter === "drankje") {
      return log.type.includes("drankje") || log.type === "rekening_betaald";
    }

    if (filter === "whitelist") {
      return log.type.includes("whitelist");
    }

    if (filter === "admin") {
      return log.category === "admin"
        || log.type.startsWith("admin_")
        || [
          "whitelist_ingeschakeld",
          "whitelist_uitgeschakeld",
          "whitelist_limiet_gewijzigd"
        ].includes(log.type);
    }

    return true;
  });

  filtered.forEach(log => {
    const li = document.createElement("li");
    li.className = "log-item";

    const date = new Date(log.timestamp);
    const time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    const iconMap = {
      lid_toegevoegd: "➕👤",
      lid_verwijderd: "❌👤",
      drankje_toegevoegd: "➕🍺",
      drankje_verwijderd: "❌🍺",
      whitelist_ingeschakeld: "🟢🔓",
      whitelist_uitgeschakeld: "🔴🔒",
      whitelist_limiet_gewijzigd: "💶⚙️",
      admin_limiet_gewijzigd: "💶⚙️",
      admin_pincode_gewijzigd: "🔐",
      admin_uitlogtijd_gewijzigd: "⏱️",
      lid_bijnaam_toegevoegd: "➕🏷️",
      lid_bijnaam_gewijzigd: "✏️🏷️",
      lid_bijnaam_verwijderd: "❌🏷️",
      lid_bijnamen_ingeschakeld: "✅🏷️",
      lid_bijnamen_uitgeschakeld: "⏸️🏷️"
    };
    
    const memberName =
      log.member ||
      log.name ||
      log.user ||
      "Onbekend";
    
      const drinkText =
      log.type === "drankje_verwijderd"
        ? `Er is <b>${log.drink}</b> verwijderd bij`
        : log.type === "drankje_toegevoegd"
        ? `Er is een <b>${log.drink} </b> toegevoegd bij`
        : log.action || "";
    
    li.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-icon">${iconMap[log.type] || "📌"}</span>
      <span class="log-text">
        ${drinkText}
        <b> ${escapeLogText(memberName)}</b>
        ${log.detail ? `<span> — ${escapeLogText(log.detail)}</span>` : ""}
        ${log.amount ? `(€${log.amount})` : ""}
        ${log.performedByLoginId ? `<small class="log-actor">Uitgevoerd door ${escapeLogText(log.performedBy)} (${escapeLogText(log.performedByLoginId)})</small>` : ""}
      </span>
    `;
    
    logList.appendChild(li);
  });
}

document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {

    document.querySelectorAll('.sub-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    document.querySelectorAll('.sub-tab-content').forEach(c => {
      c.classList.remove('active');
    });

    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add('active');

    // 👇 BELANGRIJK
    if (btn.dataset.tab === 'whitelist') loadAdminDashboard();
    if (btn.dataset.tab === 'logboek') {
      window.currentLogFilter = "all"; // optioneel reset
      loadLogboek();
    }

  });
});

const clearLogsBtn = document.getElementById("clearLogsBtn");

if (clearLogsBtn) {
  clearLogsBtn.addEventListener("click", () => {
    if (confirm("Weet je zeker dat je het logboek wilt wissen?")) {
      localStorage.removeItem("logs");
      loadLogboek();
      showNotification("Logboek gewist!");
    }
  });
}


const filterBtn = document.getElementById("logFilterBtn");
const filterMenu = document.getElementById("logFilterMenu");

filterBtn?.addEventListener("click", () => {
  filterMenu.classList.toggle("hidden");
});

filterMenu?.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  window.currentLogFilter = btn.dataset.filter || "all";

  filterMenu.classList.add("hidden");

  loadLogboek(); // 🔥 DIT MIS JE NU
});
