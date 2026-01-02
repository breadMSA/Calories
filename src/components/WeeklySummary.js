// Weekly Summary Component - Achievement tracking view

import { getRecords, getTodayDate, formatDate } from '../utils/api.js';
import { formatNumber } from '../utils/calculator.js';

export function WeeklySummary({ profile, onClose }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const targets = profile.targets;

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

    // Close handlers
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        onClose();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            onClose();
        }
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
        const weekData = [];

        for (const date of days) {
            try {
                const record = await getRecords(date);
                weekData.push({
                    date,
                    totals: record.totals || { calories: 0, protein: 0, sodium: 0, water: 0 }
                });
            } catch (error) {
                weekData.push({
                    date,
                    totals: { calories: 0, protein: 0, sodium: 0, water: 0 }
                });
            }
        }

        renderWeekSummary(weekData);
    }

    // Check if target is met (80% or more is considered good, sodium is inverted)
    function isTargetMet(current, target, isSodium = false) {
        if (target <= 0) return false;
        const percentage = (current / target) * 100;
        if (isSodium) {
            // For sodium, staying under 100% is good
            return percentage <= 100;
        }
        // For others, reaching 80% or more is good
        return percentage >= 80;
    }

    // Get day name in Chinese
    function getDayName(dateStr) {
        const date = new Date(dateStr);
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        return days[date.getDay()];
    }

    // Format date for display
    function formatShortDate(dateStr) {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function renderWeekSummary(weekData) {
        const nutrients = [
            { key: 'calories', icon: '🔥', name: '熱量', isSodium: false },
            { key: 'protein', icon: '💪', name: '蛋白質', isSodium: false },
            { key: 'sodium', icon: '🧂', name: '鈉', isSodium: true },
            { key: 'water', icon: '💧', name: '水分', isSodium: false }
        ];

        // Calculate weekly stats
        const weeklyStats = nutrients.map(n => {
            let achievedDays = 0;
            weekData.forEach(day => {
                if (isTargetMet(day.totals[n.key], targets[n.key], n.isSodium)) {
                    achievedDays++;
                }
            });
            return {
                ...n,
                achievedDays,
                totalDays: 7
            };
        });

        summaryBody.innerHTML = `
      <div class="week-summary">
        <!-- Weekly Overview -->
        <div class="summary-overview">
          ${weeklyStats.map(stat => `
            <div class="summary-stat ${stat.achievedDays >= 5 ? 'good' : stat.achievedDays >= 3 ? 'ok' : 'bad'}">
              <span class="stat-icon">${stat.icon}</span>
              <span class="stat-value">${stat.achievedDays}/7</span>
              <span class="stat-label">${stat.name}</span>
            </div>
          `).join('')}
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
                  <tr class="${isToday ? 'today' : ''}">
                    <td class="date-cell">
                      <div class="date-day">週${getDayName(day.date)}</div>
                      <div class="date-num">${formatShortDate(day.date)}</div>
                    </td>
                    ${nutrients.map(n => {
                const met = isTargetMet(day.totals[n.key], targets[n.key], n.isSodium);
                const hasData = day.totals[n.key] > 0;
                return `
                        <td class="check-cell">
                          ${hasData ? (met ? '<span class="check-good">✓</span>' : '<span class="check-bad">✗</span>') : '<span class="check-none">-</span>'}
                        </td>
                      `;
            }).join('')}
                  </tr>
                `;
        }).join('')}
            </tbody>
          </table>
        </div>

        <p class="summary-note">
          ✓ 達標（≥80%目標） ✗ 未達標 - 無記錄
          <br>
          <small>🧂 鈉攝取以不超過為達標</small>
        </p>
      </div>
    `;
    }

    // Load data
    loadWeekData();

    return overlay;
}
