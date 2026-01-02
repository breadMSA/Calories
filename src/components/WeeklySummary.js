// Weekly Summary Component - Achievement tracking view

import { getRecords, getTodayDate, formatDate } from '../utils/api.js';
import { formatNumber } from '../utils/calculator.js';

export function WeeklySummary({ profile, onClose, onViewDay }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const targets = profile.targets;
  let weekData = [];

  overlay.innerHTML = `
    <div class="modal" style="max-height: 95vh;">
      <div class="modal-header">
        <h2 class="modal-title">📊 每週達成總表</h2>
        <button class="modal-close" id="close-btn">✕</button>
      </div>
      
      <div class="modal-body" id="summary-body">
        <div class="loading">
          <div class="loading-spinner"></div>
          <span class="loading-text">載入中...</span>
        </div>
      </div>
    </div>
  `;

  const closeBtn = overlay.querySelector('#close-btn');
  const summaryBody = overlay.querySelector('#summary-body');

  // Close function
  function close() {
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose();
  }

  // ESC key handler
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      close();
    }
  }
  document.addEventListener('keydown', handleKeyDown);

  // Close handlers
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Get the last 7 days
  function getLast7Days() {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  }

  // Load data for the week
  async function loadWeekData() {
    const days = getLast7Days();
    weekData = [];

    for (const date of days) {
      try {
        const record = await getRecords(date);
        weekData.push({
          date,
          totals: record.totals || { calories: 0, protein: 0, sodium: 0, water: 0 },
          entries: record.entries || [],
          hasAnyData: (record.entries && record.entries.length > 0)
        });
      } catch (error) {
        weekData.push({
          date,
          totals: { calories: 0, protein: 0, sodium: 0, water: 0 },
          entries: [],
          hasAnyData: false
        });
      }
    }

    renderWeekSummary();
  }

  // Check if target is met (only if day has data)
  function isTargetMet(current, target, isSodium = false, hasData = false) {
    if (!hasData) return null; // No data = no judgment
    if (target <= 0) return false;
    const percentage = (current / target) * 100;
    if (isSodium) {
      return percentage <= 100;
    }
    return percentage >= 80;
  }

  function getDayName(dateStr) {
    const date = new Date(dateStr);
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[date.getDay()];
  }

  function formatShortDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderWeekSummary() {
    const nutrients = [
      { key: 'calories', icon: '🔥', name: '熱量', isSodium: false },
      { key: 'protein', icon: '💪', name: '蛋白質', isSodium: false },
      { key: 'sodium', icon: '🧂', name: '鈉', isSodium: true },
      { key: 'water', icon: '💧', name: '水分', isSodium: false }
    ];

    // Calculate weekly stats (only count days with data)
    const weeklyStats = nutrients.map(n => {
      let achievedDays = 0;
      let daysWithData = 0;
      weekData.forEach(day => {
        if (day.hasAnyData) {
          daysWithData++;
          const met = isTargetMet(day.totals[n.key], targets[n.key], n.isSodium, true);
          if (met) achievedDays++;
        }
      });
      return {
        ...n,
        achievedDays,
        daysWithData
      };
    });

    summaryBody.innerHTML = `
      <div class="week-summary">
        <!-- Weekly Overview -->
        <div class="summary-overview">
          ${weeklyStats.map(stat => {
      const ratio = stat.daysWithData > 0 ? stat.achievedDays / stat.daysWithData : 0;
      const statusClass = ratio >= 0.7 ? 'good' : ratio >= 0.4 ? 'ok' : 'bad';
      return `
            <div class="summary-stat ${stat.daysWithData > 0 ? statusClass : ''}">
              <span class="stat-icon">${stat.icon}</span>
              <span class="stat-value">${stat.achievedDays}/${stat.daysWithData}</span>
              <span class="stat-label">${stat.name}</span>
            </div>
          `;
    }).join('')}
        </div>

        <!-- Daily Breakdown Table -->
        <div class="summary-table-wrapper">
          <table class="summary-table">
            <thead>
              <tr>
                <th>日期</th>
                ${nutrients.map(n => `<th>${n.icon}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${weekData.map(day => {
      const isToday = day.date === getTodayDate();
      return `
                  <tr class="${isToday ? 'today' : ''} clickable-row" data-date="${day.date}">
                    <td class="date-cell">
                      <div class="date-day">週${getDayName(day.date)}</div>
                      <div class="date-num">${formatShortDate(day.date)}</div>
                    </td>
                    ${nutrients.map(n => {
        const met = isTargetMet(day.totals[n.key], targets[n.key], n.isSodium, day.hasAnyData);
        if (met === null) {
          return `<td class="check-cell"><span class="check-none">-</span></td>`;
        }
        return `<td class="check-cell">${met ? '<span class="check-good">✓</span>' : '<span class="check-bad">✗</span>'}</td>`;
      }).join('')}
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <p class="summary-note">
          ✓ 達標（≥80%目標） ✗ 未達標 - 無記錄<br>
          <small>🧂 鈉攝取以不超過為達標 • 點擊日期查看詳細</small>
        </p>
      </div>
    `;

    // Add click handlers for rows
    summaryBody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const date = row.dataset.date;
        showDayDetail(date);
      });
    });
  }

  // Show detail for a specific day
  function showDayDetail(date) {
    const dayData = weekData.find(d => d.date === date);
    if (!dayData) return;

    const nutrients = [
      { key: 'calories', icon: '🔥', name: '熱量', unit: 'kcal' },
      { key: 'protein', icon: '💪', name: '蛋白質', unit: 'g' },
      { key: 'sodium', icon: '🧂', name: '鈉', unit: 'mg' },
      { key: 'water', icon: '💧', name: '水分', unit: 'ml' }
    ];

    summaryBody.innerHTML = `
      <div class="day-detail">
        <button class="btn btn-ghost mb-md" id="back-btn">← 返回總表</button>
        
        <h3 class="mb-md">${formatDate(date)}</h3>
        
        <div class="detail-stats">
          ${nutrients.map(n => {
      const current = dayData.totals[n.key] || 0;
      const target = targets[n.key];
      const percent = target > 0 ? Math.round((current / target) * 100) : 0;
      return `
              <div class="detail-stat">
                <span class="detail-icon">${n.icon}</span>
                <div class="detail-info">
                  <div class="detail-name">${n.name}</div>
                  <div class="detail-value">${formatNumber(current)} / ${formatNumber(target)} ${n.unit}</div>
                  <div class="detail-bar">
                    <div class="detail-bar-fill" style="width: ${Math.min(100, percent)}%"></div>
                  </div>
                </div>
                <span class="detail-percent">${percent}%</span>
              </div>
            `;
    }).join('')}
        </div>

        ${dayData.entries.length > 0 ? `
          <h4 class="mt-lg mb-md">飲食記錄</h4>
          <div class="food-list">
            ${dayData.entries.map(entry => `
              <div class="food-item">
                <div class="food-icon">${entry.source === 'ai' ? '🤖' : '✏️'}</div>
                <div class="food-info">
                  <div class="food-name">${entry.name}</div>
                  <div class="food-meta">${entry.time}</div>
                </div>
                <div class="food-nutrients">
                  <span>🔥${entry.calories}</span>
                  <span>💪${entry.protein}g</span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state mt-lg">
            <div class="empty-state-icon">🍽️</div>
            <p class="empty-state-text">這天沒有飲食記錄</p>
          </div>
        `}
      </div>
    `;

    // Back button handler
    summaryBody.querySelector('#back-btn').addEventListener('click', renderWeekSummary);
  }

  // Load data
  loadWeekData();

  return overlay;
}
