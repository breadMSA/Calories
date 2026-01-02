// Calendar Summary Component - Day/Week/Month/Year views

import { getRecords, getTodayDate, formatDate } from '../utils/api.js';
import { formatNumber } from '../utils/calculator.js';

export function CalendarSummary({ profile, onClose }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const targets = profile.targets;
    let currentView = 'week'; // day, week, month, year
    let currentDate = new Date();
    let cachedData = {};

    overlay.innerHTML = `
    <div class="modal calendar-modal">
      <div class="modal-header">
        <h2 class="modal-title">📊 達成總表</h2>
        <button class="modal-close" id="close-btn">✕</button>
      </div>
      
      <div class="calendar-nav">
        <button class="nav-arrow" id="prev-btn">◀</button>
        <span class="nav-title" id="nav-title">-</span>
        <button class="nav-arrow" id="next-btn">▶</button>
      </div>
      
      <div class="view-tabs">
        <button class="view-tab active" data-view="day">日</button>
        <button class="view-tab" data-view="week">週</button>
        <button class="view-tab" data-view="month">月</button>
        <button class="view-tab" data-view="year">年</button>
      </div>
      
      <div class="modal-body" id="calendar-body">
        <div class="loading">
          <div class="loading-spinner"></div>
          <span class="loading-text">載入中...</span>
        </div>
      </div>
    </div>
  `;

    const closeBtn = overlay.querySelector('#close-btn');
    const prevBtn = overlay.querySelector('#prev-btn');
    const nextBtn = overlay.querySelector('#next-btn');
    const navTitle = overlay.querySelector('#nav-title');
    const calendarBody = overlay.querySelector('#calendar-body');
    const viewTabs = overlay.querySelectorAll('.view-tab');

    // Close function
    function close() {
        document.removeEventListener('keydown', handleKeyDown);
        overlay.remove();
        onClose();
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
    }
    document.addEventListener('keydown', handleKeyDown);

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Navigation
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));

    function navigate(direction) {
        if (currentView === 'day') {
            currentDate.setDate(currentDate.getDate() + direction);
        } else if (currentView === 'week') {
            currentDate.setDate(currentDate.getDate() + (7 * direction));
        } else if (currentView === 'month') {
            currentDate.setMonth(currentDate.getMonth() + direction);
        } else if (currentView === 'year') {
            currentDate.setFullYear(currentDate.getFullYear() + direction);
        }
        render();
    }

    // View tabs
    viewTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            viewTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentView = tab.dataset.view;
            render();
        });
    });

    // Helper functions
    function formatDateStr(date) {
        return date.toISOString().split('T')[0];
    }

    function getDayName(date) {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        return days[date.getDay()];
    }

    function getMonthName(month) {
        return `${month + 1}月`;
    }

    async function fetchData(dateStr) {
        if (cachedData[dateStr]) return cachedData[dateStr];
        try {
            const data = await getRecords(dateStr);
            cachedData[dateStr] = {
                totals: data.totals || { calories: 0, protein: 0, sodium: 0, water: 0 },
                entries: data.entries || [],
                hasData: (data.entries && data.entries.length > 0)
            };
        } catch {
            cachedData[dateStr] = {
                totals: { calories: 0, protein: 0, sodium: 0, water: 0 },
                entries: [],
                hasData: false
            };
        }
        return cachedData[dateStr];
    }

    function isTargetMet(current, target, isSodium = false, hasData = false) {
        if (!hasData) return null;
        if (target <= 0) return false;
        const pct = (current / target) * 100;
        return isSodium ? pct <= 100 : pct >= 80;
    }

    const nutrients = [
        { key: 'calories', icon: '🔥', name: '熱量', unit: 'kcal', isSodium: false },
        { key: 'protein', icon: '💪', name: '蛋白質', unit: 'g', isSodium: false },
        { key: 'sodium', icon: '🧂', name: '鈉', unit: 'mg', isSodium: true },
        { key: 'water', icon: '💧', name: '水分', unit: 'ml', isSodium: false }
    ];

    // Render functions
    async function render() {
        calendarBody.innerHTML = `<div class="loading"><div class="loading-spinner"></div></div>`;

        if (currentView === 'day') {
            await renderDayView();
        } else if (currentView === 'week') {
            await renderWeekView();
        } else if (currentView === 'month') {
            await renderMonthView();
        } else if (currentView === 'year') {
            await renderYearView();
        }
    }

    async function renderDayView() {
        const dateStr = formatDateStr(currentDate);
        navTitle.textContent = formatDate(dateStr);

        const data = await fetchData(dateStr);

        calendarBody.innerHTML = `
      <div class="day-view">
        <div class="day-stats">
          ${nutrients.map(n => {
            const current = data.totals[n.key] || 0;
            const target = targets[n.key];
            const pct = target > 0 ? Math.round((current / target) * 100) : 0;
            const met = isTargetMet(current, target, n.isSodium, data.hasData);
            return `
              <div class="day-stat ${met === true ? 'met' : met === false ? 'not-met' : ''}">
                <span class="day-stat-icon">${n.icon}</span>
                <div class="day-stat-info">
                  <div class="day-stat-name">${n.name}</div>
                  <div class="day-stat-value">${formatNumber(current)} / ${formatNumber(target)} ${n.unit}</div>
                  <div class="day-stat-bar"><div class="day-stat-fill" style="width: ${Math.min(100, pct)}%"></div></div>
                </div>
                <span class="day-stat-pct">${pct}%</span>
              </div>
            `;
        }).join('')}
        </div>
        
        ${data.entries.length > 0 ? `
          <h4 class="mt-lg mb-md">飲食記錄</h4>
          <div class="food-list-mini">
            ${data.entries.map(e => `
              <div class="food-mini">${e.source === 'ai' ? '🤖' : '✏️'} ${e.name} <span>${e.time}</span></div>
            `).join('')}
          </div>
        ` : `<div class="empty-state mt-lg"><div class="empty-state-icon">🍽️</div><p class="empty-state-text">這天沒有記錄</p></div>`}
      </div>
    `;
    }

    async function renderWeekView() {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        navTitle.textContent = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }

        // Fetch all data
        const weekData = await Promise.all(days.map(async d => {
            const dateStr = formatDateStr(d);
            return { date: d, dateStr, ...(await fetchData(dateStr)) };
        }));

        // Stats
        const stats = nutrients.map(n => {
            let achieved = 0, total = 0;
            weekData.forEach(d => {
                if (d.hasData) {
                    total++;
                    if (isTargetMet(d.totals[n.key], targets[n.key], n.isSodium, true)) achieved++;
                }
            });
            return { ...n, achieved, total };
        });

        const today = formatDateStr(new Date());

        calendarBody.innerHTML = `
      <div class="week-view">
        <div class="week-stats">
          ${stats.map(s => `
            <div class="week-stat ${s.total > 0 ? (s.achieved / s.total >= 0.7 ? 'good' : s.achieved / s.total >= 0.4 ? 'ok' : 'bad') : ''}">
              <span>${s.icon}</span>
              <span class="week-stat-val">${s.achieved}/${s.total}</span>
            </div>
          `).join('')}
        </div>
        
        <table class="week-table">
          <thead>
            <tr>
              <th>日期</th>
              ${nutrients.map(n => `<th>${n.icon}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${weekData.map(d => `
              <tr class="${d.dateStr === today ? 'today' : ''}">
                <td class="week-date">
                  <div class="week-day">週${getDayName(d.date)}</div>
                  <div class="week-num">${d.date.getMonth() + 1}/${d.date.getDate()}</div>
                </td>
                ${nutrients.map(n => {
            const met = isTargetMet(d.totals[n.key], targets[n.key], n.isSodium, d.hasData);
            return `<td>${met === null ? '-' : met ? '<span class="check-good">✓</span>' : '<span class="check-bad">✗</span>'}</td>`;
        }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    }

    async function renderMonthView() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        navTitle.textContent = `${year}年${month + 1}月`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPad = firstDay.getDay();

        const days = [];
        // Padding for start
        for (let i = 0; i < startPad; i++) days.push(null);
        // Actual days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        // Fetch all data for the month
        const monthData = {};
        await Promise.all(days.filter(d => d).map(async d => {
            const dateStr = formatDateStr(d);
            monthData[dateStr] = await fetchData(dateStr);
        }));

        const today = formatDateStr(new Date());

        calendarBody.innerHTML = `
      <div class="month-view">
        <div class="month-header">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="month-grid">
          ${days.map(d => {
            if (!d) return '<div class="month-cell empty"></div>';
            const dateStr = formatDateStr(d);
            const data = monthData[dateStr];
            const achieved = nutrients.filter(n =>
                isTargetMet(data.totals[n.key], targets[n.key], n.isSodium, data.hasData) === true
            ).length;
            const cls = !data.hasData ? '' : achieved >= 3 ? 'good' : achieved >= 2 ? 'ok' : 'bad';
            return `
              <div class="month-cell ${cls} ${dateStr === today ? 'today' : ''}">
                <span class="month-day">${d.getDate()}</span>
                ${data.hasData ? `<span class="month-score">${achieved}/4</span>` : ''}
              </div>
            `;
        }).join('')}
        </div>
        <div class="month-legend">
          <span><span class="dot good"></span> 3-4項達標</span>
          <span><span class="dot ok"></span> 2項達標</span>
          <span><span class="dot bad"></span> 0-1項達標</span>
        </div>
      </div>
    `;
    }

    async function renderYearView() {
        const year = currentDate.getFullYear();
        navTitle.textContent = `${year}年`;

        // For each month, calculate stats
        const monthStats = [];

        for (let m = 0; m < 12; m++) {
            const daysInMonth = new Date(year, m + 1, 0).getDate();
            let totalDays = 0, achievedDays = 0;

            // Sample: check every 3rd day to reduce API calls
            for (let d = 1; d <= daysInMonth; d += 3) {
                const dateStr = formatDateStr(new Date(year, m, d));
                const data = await fetchData(dateStr);
                if (data.hasData) {
                    totalDays++;
                    const achieved = nutrients.filter(n =>
                        isTargetMet(data.totals[n.key], targets[n.key], n.isSodium, true) === true
                    ).length;
                    if (achieved >= 3) achievedDays++;
                }
            }

            monthStats.push({ month: m, totalDays, achievedDays });
        }

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        calendarBody.innerHTML = `
      <div class="year-view">
        <div class="year-grid">
          ${monthStats.map(ms => {
            const pct = ms.totalDays > 0 ? Math.round((ms.achievedDays / ms.totalDays) * 100) : 0;
            const cls = ms.totalDays === 0 ? '' : pct >= 70 ? 'good' : pct >= 40 ? 'ok' : 'bad';
            const isCurrent = year === currentYear && ms.month === currentMonth;
            return `
              <div class="year-month ${cls} ${isCurrent ? 'current' : ''}">
                <div class="year-month-name">${ms.month + 1}月</div>
                <div class="year-month-pct">${ms.totalDays > 0 ? pct + '%' : '-'}</div>
              </div>
            `;
        }).join('')}
        </div>
        <p class="text-muted text-center mt-md" style="font-size: var(--font-size-xs);">
          百分比為「達成 3 項以上」的天數比例（抽樣估算）
        </p>
      </div>
    `;
    }

    // Initial render - start with week view
    currentView = 'week';
    render();

    return overlay;
}
