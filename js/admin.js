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

    logs.push({
      ...entry,
      timestamp: Date.now()
    });

    localStorage.setItem("logs", JSON.stringify(logs));
  }

  // === Elementen ophalen ===
  const backButton = document.getElementById('backButton');
  const statisticsButton = document.getElementById('statisticsButton');

  const addMemberForm = document.getElementById('addMemberForm');
  const memberNameInput = document.getElementById('memberName');

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

  // PWA
  const installButton = document.getElementById('installButton');

  const DEFAULT_PIN = '0000';

  // State voor pin-popup flow
  let actionContext = 'delete';      // 'delete' | 'change'
  let currentType = null;            // 'lid' | 'drankje' (bij delete)
  let currentName = null;            // item naam (bij delete)
  let pendingNewPin = null;          // tijdelijke opslag nieuwe pincode (bij change)

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
      headerLogo.src = '/assets/images/logo-Custom.jpg';
      return;
    }
    if (customLogo && customLogoEnabled) {
      headerLogo.src = customLogo;
      return;
    }
    headerLogo.src = document.body.classList.contains('dark-mode')
      ? '/assets/images/logo-dark.png'
      : '/assets/images/logo-light.png';
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
  }

  // Maak promptForPincode globaal (verwijder-flow)
  window.promptForPincode = function (type, name) {
    actionContext = 'delete';
    currentType = type;
    currentName = name;
    openPinPopup('Bevestig met pincode');
  };

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

    leden.forEach(member => {
      const li = document.createElement('li');
      li.innerHTML = `
        ${member.name}
        <button onclick="promptForPincode('lid', '${member.name.replace(/'/g, "\\'")}')">
          Verwijder
        </button>
      `;
      ledenToRemove.appendChild(li);
    });
  }

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
  if (statisticsButton) statisticsButton.addEventListener('click', () => window.location.href = '/pages/statistics.html');
  if (addMemberForm) {
    addMemberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const memberName = (memberNameInput?.value || '').trim();
      if (memberName) {
        const leden = JSON.parse(localStorage.getItem('leden')) || [];
        leden.push({ name: memberName, amount: 0 });

        addLog({
          type: "lid_toegevoegd",
          name: memberName
        });
        localStorage.setItem('leden', JSON.stringify(leden));
        if (memberNameInput) memberNameInput.value = '';
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

    const headerLogo = document.getElementById('headerLogo');
    if (headerLogo) headerLogo.src = '/assets/images/logo-light.png';
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

  window.toggleWhitelist = function (index) {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];

    const member = leden[index];

    // nieuwe status bepalen
    const newStatus = !member.exempt;
    member.exempt = newStatus;

    localStorage.setItem('leden', JSON.stringify(leden));

    addLog({
      type: "whitelist",
      member: member.name,
      action: "toegevoegd aan whitelist"
    });

    loadAdminDashboard();
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
      return log.type.includes("drankje");
    }

    if (filter === "whitelist") {
      return log.type.includes("whitelist");
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
      whitelist_uitgeschakeld: "🔴🔒"
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
        <b> ${memberName}</b>
        ${log.amount ? `(€${log.amount})` : ""}
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