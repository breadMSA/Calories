// Dashboard Component - Main daily tracking view

import { getRecords, deleteFoodEntry, getTodayDate, formatDate } from '../utils/api.js';
import { calculatePercentage, formatNumber } from '../utils/calculator.js';

export function Dashboard({ profile, onAddFood, onPhotoAnalyze, onSettings, onWeeklySummary }) {
  const container = document.createElement('div');
  container.className = 'page';

  const today = getTodayDate();
  const targets = profile.targets;

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
    
    <div class="fab-container">
      <button class="fab fab-secondary" id="photo-btn" title="拍照分析">
        📷
      </button>
      <button class="fab" id="add-btn" title="手動新增">
        ➕
      </button>
    </div>
  `;

  const statsContainer = container.querySelector('#stats-container');
  const foodListContainer = container.querySelector('#food-list');
  const settingsBtn = container.querySelector('#settings-btn');
  const summaryBtn = container.querySelector('#summary-btn');
  const addBtn = container.querySelector('#add-btn');
  const photoBtn = container.querySelector('#photo-btn');

  // Event listeners
  settingsBtn.addEventListener('click', onSettings);
  summaryBtn.addEventListener('click', onWeeklySummary);
  addBtn.addEventListener('click', onAddFood);
  photoBtn.addEventListener('click', onPhotoAnalyze);

  // Load and render data
  async function loadData() {
    try {
      const data = await getRecords(today);
      renderStats(data.totals || { calories: 0, protein: 0, sodium: 0, water: 0 });
      renderFoodList(data.entries || []);
    } catch (error) {
      console.error('Load error:', error);
      renderStats({ calories: 0, protein: 0, sodium: 0, water: 0 });
      renderFoodList([]);
    }
  }

  function renderStats(totals) {
    const nutrients = [
      {
        key: 'calories',
        icon: '🔥',
        name: '熱量',
        unit: 'kcal',
        color: 'var(--color-calories)'
      },
      {
        key: 'protein',
        icon: '💪',
        name: '蛋白質',
        unit: 'g',
        color: 'var(--color-protein)'
      },
      {
        key: 'sodium',
        icon: '🧂',
        name: '鈉',
        unit: 'mg',
        color: 'var(--color-sodium)'
      },
      {
        key: 'water',
        icon: '💧',
        name: '水分',
        unit: 'ml',
        color: 'var(--color-water)'
      }
    ];

    statsContainer.innerHTML = `
      <div class="nutrient-grid">
        ${nutrients.map(n => {
      const current = totals[n.key] || 0;
      const target = targets[n.key] || 1;
      const percent = calculatePercentage(current, target);

      return `
            <div class="nutrient-card ${n.key}">
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
          <div class="food-item" data-id="${entry.id}">
            <div class="food-icon">${entry.source === 'ai' ? '🤖' : '✏️'}</div>
            <div class="food-info">
              <div class="food-name">${entry.name}</div>
              <div class="food-meta">${entry.time}</div>
            </div>
            <div class="food-calories">${formatNumber(entry.calories)} kcal</div>
            <button class="food-delete" data-id="${entry.id}">✕</button>
          </div>
        `).join('')}
      </div>
    `;

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
