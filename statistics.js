// statistics.js
document.addEventListener("DOMContentLoaded", () => {
    // --- Elements ---
    const backButton = document.getElementById("backButton");
    const adminButton = document.getElementById("adminButton");
    const resetAllButton = document.getElementById("resetAllButton");
  
    const totalMembersSpan = document.getElementById("totalMembers");
    const totalSpentAmountSpan = document.getElementById("totalSpentAmount");
    const mostPopularDrinkSpan = document.getElementById("mostPopularDrink");
    const topMembersList = document.getElementById("topMemberslist");
    const drinkSalesList = document.getElementById("drinkSalesList");
  
    // Optionele reset-popup (zelfde markup/styling als admin)
    const resetPopup = document.getElementById("resetPopup");
    const confirmResetButton = document.getElementById("confirmResetButton");
    const cancelResetButton = document.getElementById("cancelResetButton");
  
    // --- Nav ---
    if (backButton) backButton.addEventListener("click", () => (location.href = "index.html"));
    if (adminButton) adminButton.addEventListener("click", () => (location.href = "admin.html"));
  
    // --- Helpers ---
    function notify(msg) {
      if (typeof window.showNotification === "function") {
        showNotification(msg);
      } else {
        alert(msg);
      }
    }
  
    function clearStatsUI() {
      if (totalMembersSpan) totalMembersSpan.textContent = "0";
      if (totalSpentAmountSpan) totalSpentAmountSpan.textContent = "0.00";
      if (mostPopularDrinkSpan) mostPopularDrinkSpan.textContent = "Nog geen gegevens";
      if (topMembersList) topMembersList.innerHTML = "";
      if (drinkSalesList) drinkSalesList.innerHTML = "";
    }
  
    function doStatsReset() {
      // ✅ Alleen historische statistieken wissen
      localStorage.removeItem("historicalStats");
  
      // UI updaten zonder pagina te herladen
      clearStatsUI();
      calculateStatistics();
  
      notify("Historische statistieken zijn gereset!");
    }
  
    // --- Reset button: alleen historicalStats ---
    if (resetAllButton) {
      resetAllButton.addEventListener("click", () => {
        if (resetPopup) {
          // Gebruik de mooie popup als die aanwezig is
          resetPopup.classList.remove("closing");
          resetPopup.classList.add("visible");
        } else {
          // Fallback: confirm
          if (confirm("Weet je zeker dat je alle historische statistieken wilt resetten?")) {
            doStatsReset();
          }
        }
      });
    }
  
    if (cancelResetButton) {
      cancelResetButton.addEventListener("click", () => {
        if (!resetPopup) return;
        resetPopup.classList.add("closing");
        setTimeout(() => resetPopup.classList.remove("closing", "visible"), 500);
      });
    }
  
    if (confirmResetButton) {
      confirmResetButton.addEventListener("click", () => {
        if (!resetPopup) {
          doStatsReset();
          return;
        }
        resetPopup.classList.add("closing");
        setTimeout(() => {
          resetPopup.classList.remove("closing", "visible");
          doStatsReset();
        }, 300);
      });
    }
  
    // --- Stats berekenen / renderen ---
    function calculateStatistics() {
      const leden = JSON.parse(localStorage.getItem("leden")) || [];
  
      // Historische statistieken structuur
      const historicalStats =
        JSON.parse(localStorage.getItem("historicalStats")) || {
          totalSpent: 0,
          memberStats: {}, // { "Naam": { totalSpent: number } }
          drinkStats: {},  // { "DrinkNaam": count }
        };
  
      // Totaal aantal leden
      if (totalMembersSpan) totalMembersSpan.textContent = String(leden.length);
  
      // Totaal besteed bedrag (historisch)
      if (totalSpentAmountSpan)
        totalSpentAmountSpan.textContent = Number(historicalStats.totalSpent || 0).toFixed(2);
  
      // Top spenders (historisch)
      const sortedMembers = Object.entries(historicalStats.memberStats || {})
        .sort((a, b) => (b[1]?.totalSpent || 0) - (a[1]?.totalSpent || 0))
        .slice(0, 5);
  
      if (topMembersList) {
        topMembersList.innerHTML = sortedMembers
          .map(([name, stats]) => `<li>${name}: €${Number(stats.totalSpent || 0).toFixed(2)}</li>`)
          .join("");
      }
  
      // Meest populaire drankje + volledige lijst
      const sortedDrinks = Object.entries(historicalStats.drinkStats || {}).sort(
        (a, b) => (b[1] || 0) - (a[1] || 0)
      );
  
      if (mostPopularDrinkSpan)
        mostPopularDrinkSpan.textContent = sortedDrinks.length ? sortedDrinks[0][0] : "Nog geen gegevens";
  
      if (drinkSalesList) {
        drinkSalesList.innerHTML = sortedDrinks
          .map(([drink, count]) => `<li>${drink}: ${count} verkocht</li>`)
          .join("");
      }
    }
  
    // Eerste render
    calculateStatistics();
  });
  