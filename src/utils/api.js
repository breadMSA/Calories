// API utilities for communicating with backend

const API_BASE = '/api';

/**
 * Make API request with error handling
 */
async function request(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

// ===== User API =====

/**
 * Get user profile
 */
export async function getUserProfile() {
    return request('/user');
}

/**
 * Save user profile
 */
export async function saveUserProfile(profile) {
    return request('/user', {
        method: 'POST',
        body: JSON.stringify(profile)
    });
}

// ===== Records API =====

/**
 * Get records for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 */
export async function getRecords(date) {
    return request(`/records?date=${date}`);
}

/**
 * Add a food entry
 */
export async function addFoodEntry(entry) {
    return request('/records', {
        method: 'POST',
        body: JSON.stringify(entry)
    });
}

/**
 * Delete a food entry
 */
export async function deleteFoodEntry(date, entryId) {
    return request(`/records?date=${date}&id=${entryId}`, {
        method: 'DELETE'
    });
}

// ===== AI Analysis API =====

/**
 * Analyze food image using Gemini AI
 * @param {string} base64Image - Base64 encoded image
 */
export async function analyzeFood(base64Image) {
    return request('/analyze-food', {
        method: 'POST',
        body: JSON.stringify({ image: base64Image })
    });
}

// ===== Helper Functions =====

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Format date for display
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-TW', options);
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime() {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
