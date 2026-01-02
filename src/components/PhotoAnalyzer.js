// Photo Analyzer Component - AI food image analysis

import { analyzeFood, addFoodEntry, getTodayDate, getCurrentTime, generateId } from '../utils/api.js';

export function PhotoAnalyzer({ onClose, onSave }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let currentImageBase64 = null;
  let analysisResult = null;

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">📷 AI 食物分析</h2>
        <button class="modal-close" id="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div id="upload-section">
          <label class="photo-upload" id="photo-upload">
            <div class="photo-upload-icon">📸</div>
            <p class="photo-upload-text">點擊拍照或選擇照片</p>
            <input type="file" accept="image/*" capture="environment" id="photo-input" style="display: none;">
          </label>
        </div>
        
        <div id="preview-section" class="hidden">
          <div class="photo-preview">
            <img id="preview-image" src="" alt="食物照片">
          </div>
          
          <div id="loading-section" class="hidden">
            <div class="loading mt-lg">
              <div class="loading-spinner"></div>
              <span class="loading-text">AI 分析中...</span>
            </div>
          </div>
          
          <div id="result-section" class="hidden">
            <div class="analysis-result">
              <div class="analysis-food-name" id="result-name">-</div>
              <div class="analysis-nutrients">
                <div class="analysis-nutrient">
                  <span class="analysis-nutrient-icon">🔥</span>
                  <span class="analysis-nutrient-value" id="result-calories">0</span>
                  <span class="analysis-nutrient-label">kcal</span>
                </div>
                <div class="analysis-nutrient">
                  <span class="analysis-nutrient-icon">💪</span>
                  <span class="analysis-nutrient-value" id="result-protein">0</span>
                  <span class="analysis-nutrient-label">g 蛋白質</span>
                </div>
                <div class="analysis-nutrient">
                  <span class="analysis-nutrient-icon">🧂</span>
                  <span class="analysis-nutrient-value" id="result-sodium">0</span>
                  <span class="analysis-nutrient-label">mg 鈉</span>
                </div>
                <div class="analysis-nutrient">
                  <span class="analysis-nutrient-icon">💧</span>
                  <span class="analysis-nutrient-value" id="result-water">0</span>
                  <span class="analysis-nutrient-label">ml 水分</span>
                </div>
              </div>
            </div>
            
            <p class="text-center text-muted mt-md" style="font-size: var(--font-size-sm);">
              以上為 AI 估算結果，實際營養素可能有所差異
            </p>
          </div>
          
          <div id="error-section" class="hidden">
            <div class="empty-state">
              <div class="empty-state-icon">😕</div>
              <p class="empty-state-text" id="error-message">分析失敗</p>
              <button class="btn btn-secondary mt-md" id="retry-btn">重新選擇照片</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-btn" style="flex: 1;">取消</button>
        <button class="btn btn-primary hidden" id="save-btn" style="flex: 2;">✓ 加入今日記錄</button>
      </div>
    </div>
  `;

  // Elements
  const closeBtn = overlay.querySelector('#close-btn');
  const cancelBtn = overlay.querySelector('#cancel-btn');
  const saveBtn = overlay.querySelector('#save-btn');
  const photoUpload = overlay.querySelector('#photo-upload');
  const photoInput = overlay.querySelector('#photo-input');
  const uploadSection = overlay.querySelector('#upload-section');
  const previewSection = overlay.querySelector('#preview-section');
  const previewImage = overlay.querySelector('#preview-image');
  const loadingSection = overlay.querySelector('#loading-section');
  const resultSection = overlay.querySelector('#result-section');
  const errorSection = overlay.querySelector('#error-section');
  const retryBtn = overlay.querySelector('#retry-btn');

  // Result elements
  const resultName = overlay.querySelector('#result-name');
  const resultCalories = overlay.querySelector('#result-calories');
  const resultProtein = overlay.querySelector('#result-protein');
  const resultSodium = overlay.querySelector('#result-sodium');
  const resultWater = overlay.querySelector('#result-water');
  const errorMessage = overlay.querySelector('#error-message');

  // Close handlers
  const close = () => {
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose();
  };

  // ESC key handler
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      close();
    }
  }
  document.addEventListener('keydown', handleKeyDown);

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Photo selection
  photoUpload.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      currentImageBase64 = base64.split(',')[1]; // Remove data:image/...;base64, prefix
      previewImage.src = base64;

      uploadSection.classList.add('hidden');
      previewSection.classList.remove('hidden');
      loadingSection.classList.remove('hidden');
      resultSection.classList.add('hidden');
      errorSection.classList.add('hidden');
      saveBtn.classList.add('hidden');

      // Analyze
      try {
        const result = await analyzeFood(currentImageBase64);
        analysisResult = result;

        resultName.textContent = result.name || '未知食物';
        resultCalories.textContent = result.calories || 0;
        resultProtein.textContent = result.protein || 0;
        resultSodium.textContent = result.sodium || 0;
        resultWater.textContent = result.water || 0;

        loadingSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
      } catch (error) {
        console.error('Analysis error:', error);
        loadingSection.classList.add('hidden');
        errorSection.classList.remove('hidden');
        errorMessage.textContent = error.message || '分析失敗，請重試';
      }
    };
    reader.readAsDataURL(file);
  });

  // Retry
  retryBtn.addEventListener('click', () => {
    uploadSection.classList.remove('hidden');
    previewSection.classList.add('hidden');
    photoInput.value = '';
    currentImageBase64 = null;
    analysisResult = null;
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    if (!analysisResult) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';

    try {
      const entry = {
        id: generateId(),
        date: getTodayDate(),
        time: getCurrentTime(),
        name: analysisResult.name || '未知食物',
        calories: analysisResult.calories || 0,
        protein: analysisResult.protein || 0,
        sodium: analysisResult.sodium || 0,
        water: analysisResult.water || 0,
        source: 'ai'
      };

      await addFoodEntry(entry);
      showToast('已新增食物記錄');
      overlay.remove();
      onSave();
    } catch (error) {
      console.error('Save error:', error);
      showToast('新增失敗，請稍後再試', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '✓ 加入今日記錄';
    }
  });

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
