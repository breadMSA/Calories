// Main Application Entry Point

import './style.css';
import { SetupForm } from './components/SetupForm.js';
import { Dashboard } from './components/Dashboard.js';
import { FoodEntry } from './components/FoodEntry.js';
import { PhotoAnalyzer } from './components/PhotoAnalyzer.js';
import { WeeklySummary } from './components/WeeklySummary.js';
import { getUserProfile } from './utils/api.js';

class App {
  constructor() {
    this.app = document.getElementById('app');
    this.profile = null;
    this.currentPage = null;
    this.init();
  }

  async init() {
    // Show loading
    this.app.innerHTML = `
      <div class="loading" style="height: 100vh;">
        <div class="loading-spinner"></div>
        <span class="loading-text">載入中...</span>
      </div>
    `;

    try {
      // Try to load existing profile
      const profile = await getUserProfile();
      if (profile && profile.targets) {
        this.profile = profile;
        this.showDashboard();
      } else {
        this.showSetup();
      }
    } catch (error) {
      console.log('No existing profile, showing setup');
      this.showSetup();
    }
  }

  showSetup(existingProfile = null) {
    this.clearPage();

    const setupForm = SetupForm({
      existingProfile: existingProfile,
      onComplete: (profile) => {
        if (profile) {
          this.profile = profile;
          this.showDashboard();
        } else {
          // Cancelled editing
          this.showDashboard();
        }
      }
    });

    this.app.appendChild(setupForm);
    this.currentPage = setupForm;
  }

  showDashboard() {
    this.clearPage();

    const dashboard = Dashboard({
      profile: this.profile,
      onAddFood: () => this.showFoodEntry(),
      onPhotoAnalyze: () => this.showPhotoAnalyzer(),
      onSettings: () => this.showSetup(this.profile),
      onWeeklySummary: () => this.showWeeklySummary()
    });

    this.app.appendChild(dashboard);
    this.currentPage = dashboard;
  }

  showFoodEntry() {
    const modal = FoodEntry({
      onClose: () => { },
      onSave: () => {
        if (this.currentPage && this.currentPage.refresh) {
          this.currentPage.refresh();
        }
      }
    });

    document.body.appendChild(modal);
  }

  showPhotoAnalyzer() {
    const modal = PhotoAnalyzer({
      onClose: () => { },
      onSave: () => {
        if (this.currentPage && this.currentPage.refresh) {
          this.currentPage.refresh();
        }
      }
    });

    document.body.appendChild(modal);
  }

  showWeeklySummary() {
    const modal = WeeklySummary({
      profile: this.profile,
      onClose: () => { }
    });

    document.body.appendChild(modal);
  }

  clearPage() {
    this.app.innerHTML = '';
    this.currentPage = null;
  }
}

// Initialize app
new App();
