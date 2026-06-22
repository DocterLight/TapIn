
document.addEventListener('DOMContentLoaded', () => {
  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('Service Worker geregistreerd met scope:', reg.scope))
        .catch(err => console.log('Service Worker registratie mislukt:', err));
    });
  }

  const GLOBAL_LIMIT = 25; // bedrag limiet

  let pinAction = null;

  function evaluateMemberStatus(member) {
    if (member.exempt) {
      member.isBlocked = false;
      return member;
    }
  
    member.isBlocked = (member.totalAmount || 0) >= GLOBAL_LIMIT;
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
    logs.push({
      ...entry,
      timestamp: Date.now() });
    localStorage.setItem("logs", JSON.stringify(logs));
  }

  // --- Elements ---
  const ledenUl = document.getElementById('ledenUl');
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
        ? '/assets/images/logo-dark.png'
        : '/assets/images/logo-light.png';
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
  });

  // --- Navigatie knoppen ---
  if (adminButton) adminButton.addEventListener('click', () => (location.href = '/pages/admin.html'));
  if (statisticsButton) statisticsButton.addEventListener('click', () => (location.href = '/pages/statistics.html'));

  // --- Ledenlijst laden ---
  function loadLedenList() {
    const leden = JSON.parse(localStorage.getItem('leden')) || [];
    leden.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let totaal = 0;
    const frag = document.createDocumentFragment();

    leden.forEach(member => {
      if (!member?.name) return;
      const li = document.createElement('li');
      const totalForMember = Number(member.totalAmount || 0);

      li.innerHTML = `
          <span style="font-weight:700;">${member.name}</span>
          <span>€${totalForMember.toFixed(2)}</span>
        `;
      li.addEventListener('click', () => showDrankjesLijst(member.name));

      frag.appendChild(li);
      totaal += totalForMember;
    });

    ledenUl.innerHTML = '';
    ledenUl.appendChild(frag);

    if (totaalBedragEl) {
      totaalBedragEl.textContent = `Totaal: €${totaal.toFixed(2)}`;
    }
  }

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
      notify(`⛔ ${member.name} is geblokkeerd limiet €${GLOBAL_LIMIT} bereikt`);
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
        member.totalAmount = 0;
        member.drinks = [];
        localStorage.setItem('leden', JSON.stringify(leden));
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
