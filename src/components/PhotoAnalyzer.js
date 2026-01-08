// Photo Analyzer Component - AI food image analysis + Barcode scanning

import { analyzeFood, searchByBarcode, addFoodEntry, getTodayDate, getCurrentTime, generateId } from '../utils/api.js';

export function PhotoAnalyzer({ onClose, onSave }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let currentImageBase64 = null;
  let analysisResult = null;
  let scanner = null;
  let currentMode = null; // 'ai' or 'barcode'

  overlay.innerHTML = `
    <div class="modal photo-analyzer-modal">
      <div class="modal-header">
        <h2 class="modal-title" id="modal-title">📷 拍照分析</h2>
        <button class="modal-close" id="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Mode Selection -->
        <div id="mode-section" class="mode-selection">
          <p class="mode-hint">請選擇分析方式</p>
          <div class="mode-options">
            <button class="mode-option" id="ai-mode-btn">
              <div class="mode-icon">🤖</div>
              <div class="mode-label">詢問 AI</div>
              <div class="mode-desc">拍攝食物照片進行分析</div>
            </button>
            <button class="mode-option" id="barcode-mode-btn">
              <div class="mode-icon">📊</div>
              <div class="mode-label">掃描條碼</div>
              <div class="mode-desc">掃描產品條碼查詢營養</div>
            </button>
          </div>
        </div>

        <!-- AI Upload Section -->
        <div id="upload-section" class="hidden">
          <button class="back-btn" id="back-from-upload">← 返回</button>
          <div class="upload-options">
            <div class="photo-upload" id="camera-upload">
              <div class="photo-upload-icon">📷</div>
              <p class="photo-upload-text">拍照</p>
            </div>
            <div class="photo-upload" id="gallery-upload">
              <div class="photo-upload-icon">🖼️</div>
              <p class="photo-upload-text">選擇圖片</p>
            </div>
          </div>
          <input type="file" accept="image/*" capture="environment" id="camera-input" style="display: none;">
          <input type="file" accept="image/*" id="gallery-input" style="display: none;">
        </div>

        <!-- Barcode Section -->
        <div id="barcode-section" class="hidden">
          <button class="back-btn" id="back-from-barcode">← 返回</button>
          
          <div id="barcode-scanner-container" class="barcode-scanner-container">
            <div id="barcode-reader" class="barcode-reader"></div>
            <p class="barcode-hint">將條碼對準框內自動掃描</p>
          </div>
          
          <div class="barcode-alternatives">
            <p class="manual-hint">或者</p>
            <div class="barcode-alt-buttons">
              <button class="btn btn-secondary" id="barcode-image-btn">🖼️ 從圖片掃描</button>
            </div>
            <input type="file" accept="image/*" id="barcode-image-input" style="display: none;">
          </div>
          
          <div class="barcode-manual">
            <p class="manual-hint">或手動輸入條碼號碼</p>
            <div class="barcode-input-group">
              <input type="text" id="barcode-input" class="input" placeholder="輸入條碼號碼..." pattern="[0-9]*" inputmode="numeric">
              <button class="btn btn-primary" id="barcode-search-btn">查詢</button>
            </div>
          </div>
          
          <div id="barcode-loading" class="loading hidden">
            <div class="loading-spinner"></div>
            <span class="loading-text">查詢中...</span>
          </div>
        </div>
        
        <!-- Preview Section (for AI analysis) -->
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
            
            <p class="text-center text-muted mt-md" style="font-size: var(--font-size-sm);" id="result-note">
              以上為 AI 估算結果，實際營養素可能有所差異
            </p>
          </div>
          
          <div id="error-section" class="hidden">
            <div class="empty-state">
              <div class="empty-state-icon">😕</div>
              <p class="empty-state-text" id="error-message">分析失敗</p>
              <p class="error-hint hidden" id="error-hint"></p>
              <button class="btn btn-secondary mt-md" id="retry-btn">重新選擇</button>
              <button class="btn btn-ghost mt-sm hidden" id="manual-entry-btn">改用手動輸入</button>
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
  const modalTitle = overlay.querySelector('#modal-title');

  // Mode selection
  const modeSection = overlay.querySelector('#mode-section');
  const aiModeBtn = overlay.querySelector('#ai-mode-btn');
  const barcodeModeBtn = overlay.querySelector('#barcode-mode-btn');

  // AI mode elements
  const uploadSection = overlay.querySelector('#upload-section');
  const backFromUpload = overlay.querySelector('#back-from-upload');
  const cameraUpload = overlay.querySelector('#camera-upload');
  const galleryUpload = overlay.querySelector('#gallery-upload');
  const cameraInput = overlay.querySelector('#camera-input');
  const galleryInput = overlay.querySelector('#gallery-input');
  const previewSection = overlay.querySelector('#preview-section');
  const previewImage = overlay.querySelector('#preview-image');
  const loadingSection = overlay.querySelector('#loading-section');
  const resultSection = overlay.querySelector('#result-section');
  const errorSection = overlay.querySelector('#error-section');
  const retryBtn = overlay.querySelector('#retry-btn');

  // Barcode mode elements
  const barcodeSection = overlay.querySelector('#barcode-section');
  const backFromBarcode = overlay.querySelector('#back-from-barcode');
  const barcodeReader = overlay.querySelector('#barcode-reader');
  const barcodeInput = overlay.querySelector('#barcode-input');
  const barcodeSearchBtn = overlay.querySelector('#barcode-search-btn');
  const barcodeLoading = overlay.querySelector('#barcode-loading');
  const barcodeImageBtn = overlay.querySelector('#barcode-image-btn');
  const barcodeImageInput = overlay.querySelector('#barcode-image-input');

  // Result elements
  const resultName = overlay.querySelector('#result-name');
  const resultCalories = overlay.querySelector('#result-calories');
  const resultProtein = overlay.querySelector('#result-protein');
  const resultSodium = overlay.querySelector('#result-sodium');
  const resultWater = overlay.querySelector('#result-water');
  const resultNote = overlay.querySelector('#result-note');
  const errorMessage = overlay.querySelector('#error-message');
  const errorHint = overlay.querySelector('#error-hint');
  const manualEntryBtn = overlay.querySelector('#manual-entry-btn');

  // Close handlers
  const close = () => {
    stopBarcodeScanner();
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose();
  };

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

  // Mode selection handlers
  aiModeBtn.addEventListener('click', () => {
    currentMode = 'ai';
    modalTitle.textContent = '🤖 AI 食物分析';
    modeSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
  });

  barcodeModeBtn.addEventListener('click', () => {
    currentMode = 'barcode';
    modalTitle.textContent = '📊 條碼掃描';
    modeSection.classList.add('hidden');
    barcodeSection.classList.remove('hidden');
    startBarcodeScanner();
  });

  // Back buttons
  backFromUpload.addEventListener('click', () => {
    resetToModeSelection();
  });

  backFromBarcode.addEventListener('click', () => {
    stopBarcodeScanner();
    resetToModeSelection();
  });

  function resetToModeSelection() {
    currentMode = null;
    modalTitle.textContent = '📷 拍照分析';
    modeSection.classList.remove('hidden');
    uploadSection.classList.add('hidden');
    barcodeSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    saveBtn.classList.add('hidden');
    photoInput.value = '';
    currentImageBase64 = null;
    analysisResult = null;
  }

  // Barcode scanner functions
  async function startBarcodeScanner() {
    try {
      // Dynamically load html5-qrcode
      if (!window.Html5Qrcode) {
        await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
      }

      scanner = new Html5Qrcode('barcode-reader');

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.5
        },
        onBarcodeScanned,
        (errorMessage) => {
          // Ignore scan errors (no barcode in frame)
        }
      );
    } catch (error) {
      console.error('Failed to start barcode scanner:', error);
      // Show manual input option if camera fails
      barcodeReader.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📷</div>
          <p class="empty-state-text">無法存取相機</p>
          <p class="text-muted">請手動輸入條碼號碼</p>
        </div>
      `;
    }
  }

  function stopBarcodeScanner() {
    if (scanner) {
      scanner.stop().catch(() => { });
      scanner = null;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function onBarcodeScanned(decodedText) {
    stopBarcodeScanner();
    await lookupBarcode(decodedText);
  }

  // Barcode search
  barcodeSearchBtn.addEventListener('click', async () => {
    const code = barcodeInput.value.trim();
    if (code) {
      await lookupBarcode(code);
    }
  });

  barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const code = barcodeInput.value.trim();
      if (code) {
        await lookupBarcode(code);
      }
    }
  });

  async function lookupBarcode(code) {
    barcodeLoading.classList.remove('hidden');
    barcodeSection.classList.add('hidden');

    try {
      const result = await searchByBarcode(code);

      if (result.found) {
        analysisResult = result;
        showResult(result, 'barcode');
      } else {
        // Show error with manual entry option for "not found" cases
        showError(result.error || '找不到此條碼對應的產品', true);
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      showError(error.message || '查詢失敗，請稍後再試', false);
    } finally {
      barcodeLoading.classList.add('hidden');
    }
  }

  // Photo selection (AI mode) - separate camera and gallery handlers
  cameraUpload.addEventListener('click', () => cameraInput.click());
  galleryUpload.addEventListener('click', () => galleryInput.click());

  // Handle camera input (with capture attribute for mobile)
  cameraInput.addEventListener('change', handlePhotoSelected);
  galleryInput.addEventListener('change', handlePhotoSelected);

  async function handlePhotoSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      currentImageBase64 = base64.split(',')[1];
      previewImage.src = base64;

      uploadSection.classList.add('hidden');
      previewSection.classList.remove('hidden');
      loadingSection.classList.remove('hidden');
      resultSection.classList.add('hidden');
      errorSection.classList.add('hidden');
      saveBtn.classList.add('hidden');

      try {
        const result = await analyzeFood(currentImageBase64);
        analysisResult = result;
        showResult(result, 'ai');
      } catch (error) {
        console.error('Analysis error:', error);
        loadingSection.classList.add('hidden');
        errorSection.classList.remove('hidden');
        errorMessage.textContent = error.message || '分析失敗，請重試';
      }
    };
    reader.readAsDataURL(file);
  }

  // Barcode image scanning
  barcodeImageBtn.addEventListener('click', () => barcodeImageInput.click());

  barcodeImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading
    barcodeLoading.classList.remove('hidden');
    barcodeSection.classList.add('hidden');

    try {
      // Dynamically load html5-qrcode if not already loaded
      if (!window.Html5Qrcode) {
        await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
      }

      // Scan barcode from image file
      const html5QrCode = new Html5Qrcode("temp-reader", { verbose: false });
      const decodedText = await html5QrCode.scanFile(file, true);

      // Found barcode, look it up
      await lookupBarcode(decodedText);
    } catch (error) {
      console.error('Image barcode scan error:', error);
      barcodeLoading.classList.add('hidden');
      barcodeSection.classList.remove('hidden');
      showError('無法從圖片中識別條碼，請嘗試其他方式', true);
    }
  });

  function showResult(result, source) {
    resultName.textContent = result.name || '未知食物';
    resultCalories.textContent = result.calories || 0;
    resultProtein.textContent = result.protein || 0;
    resultSodium.textContent = result.sodium || 0;
    resultWater.textContent = result.water || 0;

    if (source === 'barcode') {
      resultNote.textContent = `來源：Open Food Facts（份量：${result.servingSize || '100g'}）`;
      // Show preview section without image for barcode results
      previewImage.style.display = 'none';
    } else {
      resultNote.textContent = '以上為 AI 估算結果，實際營養素可能有所差異';
      previewImage.style.display = 'block';
    }

    loadingSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    resultSection.classList.remove('hidden');
    saveBtn.classList.remove('hidden');
  }

  function showError(message, showManualOption = false) {
    previewImage.style.display = 'none';
    previewSection.classList.remove('hidden');
    errorSection.classList.remove('hidden');
    errorMessage.textContent = message;

    if (showManualOption && currentMode === 'barcode') {
      errorHint.textContent = '台灣本地產品可能不在國際資料庫中';
      errorHint.classList.remove('hidden');
      manualEntryBtn.classList.remove('hidden');
    } else {
      errorHint.classList.add('hidden');
      manualEntryBtn.classList.add('hidden');
    }
  }

  // Retry
  retryBtn.addEventListener('click', () => {
    resetToModeSelection();
  });

  // Manual entry fallback
  manualEntryBtn.addEventListener('click', () => {
    // Close this modal and trigger manual entry
    stopBarcodeScanner();
    document.removeEventListener('keydown', handleKeyDown);
    overlay.remove();
    onClose();
    // Dispatch custom event to open manual entry form
    window.dispatchEvent(new CustomEvent('openManualFoodEntry'));
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
        source: currentMode === 'barcode' ? 'barcode' : 'ai'
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
