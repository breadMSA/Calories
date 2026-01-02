// Setup Form Component - User profile configuration

import { calculateRecommendedTargets, formatNumber } from '../utils/calculator.js';
import { saveUserProfile, getUserProfile } from '../utils/api.js';

export function SetupForm({ onComplete, existingProfile = null }) {
    const container = document.createElement('div');
    container.className = 'page';

    const isEditing = !!existingProfile;
    const defaults = existingProfile || {
        height: 170,
        weight: 65,
        age: 25,
        gender: 'male',
        targets: null
    };

    container.innerHTML = `
    <div class="container">
      <div class="text-center mb-lg" style="padding-top: var(--space-xl);">
        <div style="font-size: 64px; margin-bottom: var(--space-md);">🥗</div>
        <h1>${isEditing ? '編輯個人資料' : '歡迎使用'}</h1>
        <p class="text-muted mt-md">${isEditing ? '調整您的基本資料與目標' : '設定您的基本資料開始追蹤'}</p>
      </div>
      
      <div class="card">
        <h3 class="card-title mb-lg">基本資料</h3>
        
        <div class="form-group">
          <label class="form-label">性別</label>
          <div class="tab-bar" id="gender-tabs">
            <button type="button" class="tab ${defaults.gender === 'male' ? 'active' : ''}" data-value="male">👨 男性</button>
            <button type="button" class="tab ${defaults.gender === 'female' ? 'active' : ''}" data-value="female">👩 女性</button>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">身高</label>
            <div class="input-group">
              <input type="number" class="form-input" id="height" value="${defaults.height}" min="100" max="250">
              <span class="input-suffix">cm</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">體重</label>
            <div class="input-group">
              <input type="number" class="form-input" id="weight" value="${defaults.weight}" min="30" max="300">
              <span class="input-suffix">kg</span>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">年齡</label>
          <div class="input-group" style="max-width: 150px;">
            <input type="number" class="form-input" id="age" value="${defaults.age}" min="10" max="120">
            <span class="input-suffix">歲</span>
          </div>
        </div>
      </div>
      
      <div class="card mt-lg">
        <div class="card-header">
          <h3 class="card-title">每日目標</h3>
          <button type="button" class="btn btn-ghost" id="calculate-btn">
            🔄 重新計算
          </button>
        </div>
        
        <p class="text-muted mb-lg" style="font-size: var(--font-size-sm);">
          根據您的資料自動計算，也可手動調整
        </p>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🔥 熱量目標</label>
            <div class="input-group">
              <input type="number" class="form-input" id="target-calories" value="" min="500" max="10000">
              <span class="input-suffix">kcal</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">💪 蛋白質目標</label>
            <div class="input-group">
              <input type="number" class="form-input" id="target-protein" value="" min="10" max="500">
              <span class="input-suffix">g</span>
            </div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">🧂 鈉攝取上限</label>
            <div class="input-group">
              <input type="number" class="form-input" id="target-sodium" value="" min="500" max="10000">
              <span class="input-suffix">mg</span>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">💧 水分目標</label>
            <div class="input-group">
              <input type="number" class="form-input" id="target-water" value="" min="500" max="10000">
              <span class="input-suffix">ml</span>
            </div>
          </div>
        </div>
      </div>
      
      <button type="button" class="btn btn-primary btn-block btn-lg mt-lg" id="save-btn">
        ${isEditing ? '💾 儲存變更' : '🚀 開始使用'}
      </button>
      
      ${isEditing ? `
        <button type="button" class="btn btn-ghost btn-block mt-md" id="cancel-btn">
          取消
        </button>
      ` : ''}
    </div>
  `;

    // Elements
    const genderTabs = container.querySelector('#gender-tabs');
    const heightInput = container.querySelector('#height');
    const weightInput = container.querySelector('#weight');
    const ageInput = container.querySelector('#age');
    const caloriesInput = container.querySelector('#target-calories');
    const proteinInput = container.querySelector('#target-protein');
    const sodiumInput = container.querySelector('#target-sodium');
    const waterInput = container.querySelector('#target-water');
    const calculateBtn = container.querySelector('#calculate-btn');
    const saveBtn = container.querySelector('#save-btn');
    const cancelBtn = container.querySelector('#cancel-btn');

    let currentGender = defaults.gender;

    // Calculate and update targets
    function updateTargets() {
        const profile = {
            height: parseFloat(heightInput.value) || 170,
            weight: parseFloat(weightInput.value) || 65,
            age: parseInt(ageInput.value) || 25,
            gender: currentGender
        };

        const targets = calculateRecommendedTargets(profile);
        caloriesInput.value = targets.calories;
        proteinInput.value = targets.protein;
        sodiumInput.value = targets.sodium;
        waterInput.value = targets.water;
    }

    // Initialize targets
    if (defaults.targets) {
        caloriesInput.value = defaults.targets.calories;
        proteinInput.value = defaults.targets.protein;
        sodiumInput.value = defaults.targets.sodium;
        waterInput.value = defaults.targets.water;
    } else {
        updateTargets();
    }

    // Gender tab switching
    genderTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        genderTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentGender = tab.dataset.value;
        updateTargets();
    });

    // Recalculate button
    calculateBtn.addEventListener('click', updateTargets);

    // Auto-recalculate on input change
    [heightInput, weightInput, ageInput].forEach(input => {
        input.addEventListener('change', updateTargets);
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> 儲存中...';

        try {
            const profile = {
                height: parseFloat(heightInput.value),
                weight: parseFloat(weightInput.value),
                age: parseInt(ageInput.value),
                gender: currentGender,
                targets: {
                    calories: parseInt(caloriesInput.value),
                    protein: parseInt(proteinInput.value),
                    sodium: parseInt(sodiumInput.value),
                    water: parseInt(waterInput.value)
                }
            };

            await saveUserProfile(profile);
            onComplete(profile);
        } catch (error) {
            console.error('Save error:', error);
            showToast('儲存失敗，請稍後再試', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = isEditing ? '💾 儲存變更' : '🚀 開始使用';
        }
    });

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            onComplete(null);
        });
    }

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
