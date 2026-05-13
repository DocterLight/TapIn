// shared.js
document.addEventListener('DOMContentLoaded', () => {
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const headerLogo = document.getElementById('headerLogo');
    const notificationPopup = document.getElementById('notificationPopup');
    const notificationMessage = document.getElementById('notificationMessage');
  
    // === Dark Mode on load ===
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
    }
  
    // Logo wisselen (respecteer custom upload)
    function updateLogo() {
      if (!headerLogo) return;
      const customLogo = localStorage.getItem('customLogo');
      if (customLogo) { headerLogo.src = customLogo; return; }
      headerLogo.src = document.body.classList.contains('dark-mode')
        ? 'logo-dark.png'
        : 'logo-light.png';
    }
    updateLogo();
  
    if (toggleThemeBtn) {
      toggleThemeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        updateLogo();
      });
    }
  
    // Notificatie helper (globaal)
    window.showNotification = function(message, durationMs = 3000) {
      if (!notificationPopup || !notificationMessage) { alert(message); return; }
      notificationMessage.textContent = message;
      notificationPopup.classList.remove('closing');
      void notificationPopup.offsetWidth; // reflow
      notificationPopup.classList.add('visible');
      clearTimeout(notificationPopup._timer);
      notificationPopup._timer = setTimeout(() => {
        notificationPopup.classList.remove('visible');
        notificationPopup.classList.add('closing');
        setTimeout(() => notificationPopup.classList.remove('closing'), 500);
      }, durationMs);
    };
  
    // Toepassen opgeslagen assets (logo/bg) op elke pagina
    (function applySavedAssets() {
      const savedLogo = localStorage.getItem('customLogo');
      const savedBg = localStorage.getItem('customBackground');
  
      if (savedLogo && headerLogo) {
        headerLogo.src = savedLogo;
      } else {
        updateLogo();
      }
  
      if (savedBg) {
        document.body.style.backgroundImage = `url(${savedBg})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
      }
    })();
  });
  
  // Service Worker + PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('Service Worker geregistreerd:', reg.scope))
        .catch(err => console.log('Service Worker registratie mislukt:', err));
    });
  }
  
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installButton');
    if (btn) btn.style.display = 'block';
  });
  const installBtn = document.getElementById('installButton');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => {
        deferredPrompt = null;
        installBtn.style.display = 'block';
      });
    });
  }
  