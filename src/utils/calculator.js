// Calculator utilities for nutrition calculations

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @param {number} age - Age in years
 * @param {string} gender - 'male' or 'female'
 * @returns {number} BMR in kcal
 */
export function calculateBMR(weight, height, age, gender) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Calculate Total Daily Energy Expenditure
 * Using moderate activity level (1.55)
 * @param {number} bmr - Basal Metabolic Rate
 * @returns {number} TDEE in kcal
 */
export function calculateTDEE(bmr) {
  return Math.round(bmr * 1.55);
}

/**
 * Calculate recommended daily protein intake
 * @param {number} weight - Weight in kg
 * @returns {number} Protein in grams
 */
export function calculateProtein(weight) {
  return Math.round(weight * 1.4);
}

/**
 * Calculate recommended daily water intake
 * @param {number} weight - Weight in kg
 * @returns {number} Water in ml
 */
export function calculateWater(weight) {
  return Math.round(weight * 30);
}

/**
 * Get recommended sodium limit (fixed)
 * @returns {number} Sodium in mg
 */
export function getSodiumLimit() {
  return 2300;
}

/**
 * Calculate all recommended daily targets
 * @param {Object} profile - User profile
 * @returns {Object} All recommended targets
 */
export function calculateRecommendedTargets(profile) {
  const { weight, height, age, gender } = profile;
  const bmr = calculateBMR(weight, height, age, gender);
  
  return {
    calories: calculateTDEE(bmr),
    protein: calculateProtein(weight),
    sodium: getSodiumLimit(),
    water: calculateWater(weight)
  };
}

/**
 * Calculate percentage of target reached
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Percentage (0-100, capped)
 */
export function calculatePercentage(current, target) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Format number with locale
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  return num.toLocaleString('zh-TW');
}
