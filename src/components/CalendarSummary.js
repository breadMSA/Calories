// Calendar Summary Component - Day/Week/Month views with date picker

import { getRecords, getTodayDate, formatDate } from '../utils/api.js';
import { formatNumber } from '../utils/calculator.js';

export function CalendarSummary({ profile, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const targets = profile.targets;
  let currentView = 'week'; // day, week, month
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
        <button class="nav-title-btn" id="nav-title-btn">-</button>
        <button class="nav-arrow" id="next-btn">▶</button>
      </div>
      
      <div class="view-tabs">
        <button class="view-tab" data-view="day">日</button>
        <button class="view-tab active" data-view="week">週</button>
        <button class="view-tab" data-view="month">月</button>
      </div>
      
      <div class="modal-body" id="calendar-body">
        <div class="loading">
          <div class="loading-spinner"></div>
          <span class="loading-text">載入中...</span>
        </div>
      </div>
      
      <!-- Date Picker Modal -->
      <div class="date-picker-overlay hidden" id="date-picker">
        <div class="date-picker-content">
          <div class="date-picker-header">
            <button class="nav-arrow" id="picker-prev">◀</button>
            <span id="picker-title">-</span>
            <button class="nav-arrow" id="picker-next">▶</button>
          </div>
          <div class="date-picker-grid" id="picker-grid"></div>
          <button class="btn btn-secondary btn-block mt-md" id="picker-today">回到今天</button>
        </div>
      </div>
    </div>
  `;

  const closeBtn = overlay.querySelector('#close-btn');
  const prevBtn = overlay.querySelector('#prev-btn');
  const nextBtn = overlay.querySelector('#next-btn');
  const navTitleBtn = overlay.querySelector('#nav-title-btn');
  const calendarBody = overlay.querySelector('#calendar-body');
  const viewTabs = overlay.querySelectorAll('.view-tab');
  const datePicker = overlay.querySelector('#date-picker');
  const pickerPrev = overlay.querySelector('#picker-prev');
  const pickerNext = overlay.querySelector('#picker-next');
  const pickerTitle = overlay.querySelector('#picker-title');
  const pickerGrid = overlay.querySelector('#picker-grid');
  const pickerToday = overlay.querySelector('#picker-today');

  // Close function
  function close() {
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (!datePicker.classList.contains('hidden')) {
        datePicker.classList.add('hidden');
      } else {
        close();
      }
    }
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
    }
    render();
  }

  // Date picker
  let pickerYear = currentDate.getFullYear();
  let pickerMonth = currentDate.getMonth();

  navTitleBtn.addEventListener('click', () => {
    pickerYear = currentDate.getFullYear();
    pickerMonth = currentDate.getMonth();
    renderDatePicker();
    datePicker.classList.remove('hidden');
  });

  datePicker.addEventListener('click', (e) => {
    if (e.target === datePicker) datePicker.classList.add('hidden');
  });

  pickerPrev.addEventListener('click', () => {
    pickerMonth--;
    if (pickerMonth < 0) { pickerMonth = 11; pickerYear--; }
    renderDatePicker();
  });

  pickerNext.addEventListener('click', () => {
    pickerMonth++;
    if (pickerMonth > 11) { pickerMonth = 0; pickerYear++; }
    renderDatePicker();
  });

  pickerToday.addEventListener('click', () => {
    currentDate = new Date();
    datePicker.classList.add('hidden');
    render();
  });

  function renderDatePicker() {
    pickerTitle.textContent = `${pickerYear}年${pickerMonth + 1}月`;

    const firstDay = new Date(pickerYear, pickerMonth, 1);
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
    const startPad = firstDay.getDay();

    let html = '<div class="picker-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="picker-days">';

    for (let i = 0; i < startPad; i++) html += '<span class="picker-day empty"></span>';

    const today = formatDateLocal(new Date());
    const selected = formatDateLocal(currentDate);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = formatDateLocal(new Date(pickerYear, pickerMonth, d));
      const isToday = dateStr === today;
      const isSelected = dateStr === selected;
      html += `<span class="picker-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">${d}</span>`;
    }

    html += '</div>';
    pickerGrid.innerHTML = html;

    // Click handlers
    pickerGrid.querySelectorAll('.picker-day[data-date]').forEach(day => {
      day.addEventListener('click', () => {
        const [y, m, d] = day.dataset.date.split('-').map(Number);
        currentDate = new Date(y, m - 1, d);
        datePicker.classList.add('hidden');
        render();
      });
    });
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

  // Helper functions - USE LOCAL DATES!
  function formatDateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getDayName(date) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[date.getDay()];
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

  // Jump to day view for a specific date
  function goToDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    currentDate = new Date(y, m - 1, d);
    currentView = 'day';
    viewTabs.forEach(t => t.classList.remove('active'));
    overlay.querySelector('[data-view="day"]').classList.add('active');
    render();
  }

  // Render functions
  async function render() {
    calendarBody.innerHTML = `<div class="loading"><div class="loading-spinner"></div></div>`;

    if (currentView === 'day') {
      await renderDayView();
    } else if (currentView === 'week') {
      await renderWeekView();
    } else if (currentView === 'month') {
      await renderMonthView();
    }
  }

  async function renderDayView() {
    const dateStr = formatDateLocal(currentDate);
    navTitleBtn.textContent = formatDate(dateStr);

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

    navTitleBtn.textContent = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }

    const weekData = await Promise.all(days.map(async d => {
      const dateStr = formatDateLocal(d);
      return { date: d, dateStr, ...(await fetchData(dateStr)) };
    }));

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

    const today = formatDateLocal(new Date());

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
              <tr class="${d.dateStr === today ? 'today' : ''} clickable-row" data-date="${d.dateStr}">
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

    // Make rows clickable
    calendarBody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => goToDay(row.dataset.date));
    });
  }

  async function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    navTitleBtn.textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    const monthData = {};
    await Promise.all(days.filter(d => d).map(async d => {
      const dateStr = formatDateLocal(d);
      monthData[dateStr] = await fetchData(dateStr);
    }));

    const today = formatDateLocal(new Date());

    calendarBody.innerHTML = `
      <div class="month-view">
        <div class="month-header">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="month-grid">
          ${days.map(d => {
      if (!d) return '<div class="month-cell empty"></div>';
      const dateStr = formatDateLocal(d);
      const data = monthData[dateStr];
      const achieved = nutrients.filter(n =>
        isTargetMet(data.totals[n.key], targets[n.key], n.isSodium, data.hasData) === true
      ).length;
      const cls = !data.hasData ? '' : achieved >= 3 ? 'good' : achieved >= 2 ? 'ok' : 'bad';
      return `
              <div class="month-cell ${cls} ${dateStr === today ? 'today' : ''} clickable" data-date="${dateStr}">
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

    // Make cells clickable
    calendarBody.querySelectorAll('.month-cell.clickable').forEach(cell => {
      cell.addEventListener('click', () => goToDay(cell.dataset.date));
    });
  }

  // Initial render - default to week view
  render();

  return overlay;
}
