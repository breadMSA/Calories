// Food Entry Component - Manual food input modal

import { addFoodEntry, getTodayDate, getCurrentTime, generateId } from '../utils/api.js';

export function FoodEntry({ onClose, onSave }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">新增食物</h2>
        <button class="modal-close" id="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">食物名稱</label>
          <input type="text" class="form-input" id="food-name" placeholder="例：雞胸肉便當">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🔥 熱量</label>
            <div class="input-group">
              <input type="number" class="form-input" id="food-calories" placeholder="0" min="0">
              <span class="input-suffix">kcal</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">💪 蛋白質</label>
            <div class="input-group">
              <input type="number" class="form-input" id="food-protein" placeholder="0" min="0">
              <span class="input-suffix">g</span>
            </div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🧂 鈉</label>
            <div class="input-group">
              <input type="number" class="form-input" id="food-sodium" placeholder="0" min="0">
              <span class="input-suffix">mg</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">💧 水分</label>
            <div class="input-group">
              <input type="number" class="form-input" id="food-water" placeholder="0" min="0">
              <span class="input-suffix">ml</span>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">時間</label>
          <input type="time" class="form-input" id="food-time" style="max-width: 150px;">
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-btn" style="flex: 1;">取消</button>
        <button class="btn btn-primary" id="save-btn" style="flex: 2;">✓ 新增</button>
      </div>
    </div>
  `;

    const closeBtn = overlay.querySelector('#close-btn');
    const cancelBtn = overlay.querySelector('#cancel-btn');
    const saveBtn = overlay.querySelector('#save-btn');
    const nameInput = overlay.querySelector('#food-name');
    const caloriesInput = overlay.querySelector('#food-calories');
    const proteinInput = overlay.querySelector('#food-protein');
    const sodiumInput = overlay.querySelector('#food-sodium');
    const waterInput = overlay.querySelector('#food-water');
    const timeInput = overlay.querySelector('#food-time');

    // Set default time
    timeInput.value = getCurrentTime();

    // Close handlers
    const close = () => {
        overlay.remove();
        onClose();
    };

    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Save handler
    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            nameInput.style.borderColor = '#EF4444';
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';

        try {
            const entry = {
                id: generateId(),
                date: getTodayDate(),
                time: timeInput.value || getCurrentTime(),
                name: name,
                calories: parseInt(caloriesInput.value) || 0,
                protein: parseInt(proteinInput.value) || 0,
                sodium: parseInt(sodiumInput.value) || 0,
                water: parseInt(waterInput.value) || 0,
                source: 'manual'
            };

            await addFoodEntry(entry);
            showToast('已新增食物記錄');
            overlay.remove();
            onSave();
        } catch (error) {
            console.error('Save error:', error);
            showToast('新增失敗，請稍後再試', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '✓ 新增';
        }
    });

    // Focus on name input
    setTimeout(() => nameInput.focus(), 100);

    return overlay;
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
