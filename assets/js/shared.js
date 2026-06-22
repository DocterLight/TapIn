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
        ? 'assets/images/logo-dark.png'
        : 'assets/images/logo-light.png';
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
