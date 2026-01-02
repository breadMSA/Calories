// Dashboard Component - Main daily tracking view

import { getRecords, deleteFoodEntry, getTodayDate, formatDate } from '../utils/api.js';
import { calculatePercentage, formatNumber } from '../utils/calculator.js';

export function Dashboard({ profile, onAddFood, onPhotoAnalyze, onSettings, onWeeklySummary, onEditFood }) {
  const container = document.createElement('div');
  container.className = 'page';

  const today = getTodayDate();
  const targets = profile.targets;
  let currentEntries = [];
  let fabMenuOpen = false;

  container.innerHTML = `
    <div class="container">
      <header class="header">
        <div>
          <h1 class="header-title">今日攝取</h1>
          <p class="header-date">${formatDate(today)}</p>
        </div>
        <div style="display: flex; gap: var(--space-xs);">
          <button class="btn btn-icon btn-ghost" id="summary-btn" title="每週總表">📊</button>
          <button class="btn btn-icon btn-ghost" id="settings-btn" title="設定">⚙️</button>
        </div>
      </header>
      
      <div id="stats-container">
        <div class="loading">
          <div class="loading-spinner"></div>
          <span class="loading-text">載入中...</span>
        </div>
      </div>
      
      <div class="card mt-lg">
        <div class="card-header">
          <h3 class="card-title">今日飲食記錄</h3>
        </div>
        <div id="food-list">
          <div class="loading">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Nutrient Breakdown Modal -->
    <div class="modal-overlay hidden" id="nutrient-modal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="nutrient-modal-title">營養素明細</h2>
          <button class="modal-close" id="nutrient-modal-close">✕</button>
        </div>
        <div class="modal-body" id="nutrient-modal-body"></div>
      </div>
    </div>
    
    <!-- FAB with Menu -->
    <div class="fab-container">
      <div class="fab-menu hidden" id="fab-menu">
        <button class="fab-menu-item" id="photo-btn">
          <span class="fab-menu-icon">📷</span>
          <span class="fab-menu-label">拍照分析</span>
        </button>
        <button class="fab-menu-item" id="manual-btn">
          <span class="fab-menu-icon">✏️</span>
          <span class="fab-menu-label">手動輸入</span>
        </button>
      </div>
      <button class="fab" id="add-btn" title="新增食物">
        <span id="fab-icon">➕</span>
      </button>
    </div>
  `;

  const statsContainer = container.querySelector('#stats-container');
  const foodListContainer = container.querySelector('#food-list');
  const settingsBtn = container.querySelector('#settings-btn');
  const summaryBtn = container.querySelector('#summary-btn');
  const addBtn = container.querySelector('#add-btn');
  const fabMenu = container.querySelector('#fab-menu');
  const fabIcon = container.querySelector('#fab-icon');
  const photoBtn = container.querySelector('#photo-btn');
  const manualBtn = container.querySelector('#manual-btn');
  const nutrientModal = container.querySelector('#nutrient-modal');
  const nutrientModalClose = container.querySelector('#nutrient-modal-close');
  const nutrientModalTitle = container.querySelector('#nutrient-modal-title');
  const nutrientModalBody = container.querySelector('#nutrient-modal-body');

  // Event listeners
  settingsBtn.addEventListener('click', onSettings);
  summaryBtn.addEventListener('click', onWeeklySummary);

  // FAB menu toggle
  addBtn.addEventListener('click', () => {
    fabMenuOpen = !fabMenuOpen;
    fabMenu.classList.toggle('hidden', !fabMenuOpen);
    fabIcon.textContent = fabMenuOpen ? '✕' : '➕';
    addBtn.classList.toggle('active', fabMenuOpen);
  });

  photoBtn.addEventListener('click', () => {
    closeFabMenu();
    onPhotoAnalyze();
  });

  manualBtn.addEventListener('click', () => {
    closeFabMenu();
    onAddFood();
  });

  function closeFabMenu() {
    fabMenuOpen = false;
    fabMenu.classList.add('hidden');
    fabIcon.textContent = '➕';
    addBtn.classList.remove('active');
  }

  // Nutrient modal close
  nutrientModalClose.addEventListener('click', () => nutrientModal.classList.add('hidden'));
  nutrientModal.addEventListener('click', (e) => {
    if (e.target === nutrientModal) nutrientModal.classList.add('hidden');
  });

  // Load and render data
  async function loadData() {
    try {
      const data = await getRecords(today);
      currentEntries = data.entries || [];
      renderStats(data.totals || { calories: 0, protein: 0, sodium: 0, water: 0 });
      renderFoodList(currentEntries);
    } catch (error) {
      console.error('Load error:', error);
      currentEntries = [];
      renderStats({ calories: 0, protein: 0, sodium: 0, water: 0 });
      renderFoodList([]);
    }
  }

  function renderStats(totals) {
    const nutrients = [
      { key: 'calories', icon: '🔥', name: '熱量', unit: 'kcal', color: 'var(--color-calories)' },
      { key: 'protein', icon: '💪', name: '蛋白質', unit: 'g', color: 'var(--color-protein)' },
      { key: 'sodium', icon: '🧂', name: '鈉', unit: 'mg', color: 'var(--color-sodium)' },
      { key: 'water', icon: '💧', name: '水分', unit: 'ml', color: 'var(--color-water)' }
    ];

    statsContainer.innerHTML = `
      <div class="nutrient-grid">
        ${nutrients.map(n => {
      const current = totals[n.key] || 0;
      const target = targets[n.key] || 1;
      const percent = calculatePercentage(current, target);

      return `
            <div class="nutrient-card ${n.key} clickable" data-nutrient="${n.key}">
              <div class="progress-ring-container">
                <svg class="progress-ring" width="80" height="80">
                  <circle class="progress-ring-bg" cx="40" cy="40" r="32" stroke-width="6"/>
                  <circle class="progress-ring-fill" cx="40" cy="40" r="32" stroke-width="6"
                    stroke="${n.color}"
                    stroke-dasharray="${2 * Math.PI * 32}"
                    stroke-dashoffset="${2 * Math.PI * 32 * (1 - percent / 100)}"/>
                </svg>
                <div class="progress-ring-content">
                  <span class="nutrient-icon">${n.icon}</span>
                </div>
              </div>
              <div class="nutrient-value" style="color: ${n.color}">
                ${formatNumber(Math.round(current))}
              </div>
              <div class="nutrient-target">/ ${formatNumber(target)} ${n.unit}</div>
              <div class="nutrient-name">${n.name}</div>
            </div>
          `;
    }).join('')}
      </div>
    `;

    // Add click handlers for nutrient cards
    statsContainer.querySelectorAll('.nutrient-card.clickable').forEach(card => {
      card.addEventListener('click', () => {
        const nutrientKey = card.dataset.nutrient;
        showNutrientBreakdown(nutrientKey);
      });
    });
  }

  function showNutrientBreakdown(nutrientKey) {
    const nutrientInfo = {
      calories: { name: '熱量', icon: '🔥', unit: 'kcal' },
      protein: { name: '蛋白質', icon: '💪', unit: 'g' },
      sodium: { name: '鈉', icon: '🧂', unit: 'mg' },
      water: { name: '水分', icon: '💧', unit: 'ml' }
    };

    const info = nutrientInfo[nutrientKey];
    nutrientModalTitle.textContent = `${info.icon} ${info.name}明細`;

    // Sort entries by this nutrient value
    const sortedEntries = [...currentEntries].sort((a, b) => (b[nutrientKey] || 0) - (a[nutrientKey] || 0));
    const total = sortedEntries.reduce((sum, e) => sum + (e[nutrientKey] || 0), 0);

    nutrientModalBody.innerHTML = `
      <div class="nutrient-breakdown">
        ${sortedEntries.length === 0 ? `
          <div class="empty-state">
            <p class="empty-state-text">還沒有記錄</p>
          </div>
        ` : `
          ${sortedEntries.map(entry => {
      const value = entry[nutrientKey] || 0;
      const percent = total > 0 ? Math.round((value / total) * 100) : 0;
      return `
              <div class="breakdown-item">
                <div class="breakdown-info">
                  <span class="breakdown-name">${entry.name}</span>
                  <span class="breakdown-time">${entry.time}</span>
                </div>
                <div class="breakdown-value">
                  <span class="breakdown-number">${formatNumber(value)} ${info.unit}</span>
                  <span class="breakdown-percent">${percent}%</span>
                </div>
              </div>
            `;
    }).join('')}
          <div class="breakdown-total">
            <span>總計</span>
            <span>${formatNumber(total)} ${info.unit}</span>
          </div>
        `}
      </div>
    `;

    nutrientModal.classList.remove('hidden');
  }

  function renderFoodList(entries) {
    if (entries.length === 0) {
      foodListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🍽️</div>
          <p class="empty-state-text">還沒有記錄<br>點擊下方按鈕新增食物</p>
        </div>
      `;
      return;
    }

    // Sort by time descending
    entries.sort((a, b) => b.time.localeCompare(a.time));

    foodListContainer.innerHTML = `
      <div class="food-list">
        ${entries.map(entry => `
          <div class="food-item-v2" data-id="${entry.id}">
            <div class="food-item-main">
              <div class="food-icon">${entry.source === 'ai' ? '🤖' : '✏️'}</div>
              <div class="food-info">
                <div class="food-name">${entry.name}</div>
                <div class="food-meta">${entry.time}</div>
              </div>
              <div class="food-actions">
                <button class="food-edit" data-id="${entry.id}" title="編輯">✏️</button>
                <button class="food-delete" data-id="${entry.id}" title="刪除">🗑️</button>
              </div>
            </div>
            <div class="food-nutrients-row">
              <span class="nutrient-pill calories">🔥 ${entry.calories} kcal</span>
              <span class="nutrient-pill protein">💪 ${entry.protein}g</span>
              <span class="nutrient-pill sodium">🧂 ${entry.sodium}mg</span>
              <span class="nutrient-pill water">💧 ${entry.water}ml</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Edit handlers
    foodListContainer.querySelectorAll('.food-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const entryId = btn.dataset.id;
        const entry = entries.find(e => e.id === entryId);
        if (entry && onEditFood) {
          onEditFood(entry);
        }
      });
    });

    // Delete handlers
    foodListContainer.querySelectorAll('.food-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const entryId = btn.dataset.id;

        if (confirm('確定要刪除這筆記錄嗎？')) {
          try {
            await deleteFoodEntry(today, entryId);
            loadData();
            showToast('已刪除');
          } catch (error) {
            showToast('刪除失敗', 'error');
          }
        }
      });
    });
  }

  // Initial load
  loadData();

  // Expose refresh method
  container.refresh = loadData;

  return container;
}

function showToast(message, type = 'success') {
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
