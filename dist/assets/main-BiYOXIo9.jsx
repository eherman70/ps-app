import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext';
import './index.css'; // Optional: for global styles

// API client for backend communication
const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';


class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async login(credentials) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(data.token);
    return data;
  }

  async register(credentials) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(data.token);
    return data;
  }

  // Generic CRUD methods
  async getAll(entity) {
    return await this.request(`/${entity}`);
  }

  async create(entity, data) {
    return await this.request(`/${entity}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(entity, id, data) {
    return await this.request(`/${entity}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(entity, id) {
    return await this.request(`/${entity}/${id}`, {
      method: 'DELETE',
    });
  }
}

// Create global API instance
window.api = new ApiClient();

// Legacy localStorage compatibility for migration
window.storage = {
  async get(key) {
    try {
      // For other data, try to get from API
      const entity = this.getEntityFromKey(key);
      if (entity && key.includes('_')) {
        try {
          const items = await window.api.getAll(entity);
          const prefix = key.split('_')[0];
          const item = items.find(item => `${prefix}_${item.id}` === key);
          return item ? { value: JSON.stringify(item) } : null;
        } catch (e) {
          // Fall back to localStorage
        }
      }

      // Fall back to localStorage
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch (e) {
      console.error('Storage.get error', e);
      return null;
    }
  },

  async set(key, value) {
    const entity = this.getEntityFromKey(key);
    try {
      // Try API first for new data
      if (entity) {
        const data = JSON.parse(value);
        if (key.includes('_')) {
          // Update existing item
          const id = key.split('_')[1];
          await window.api.update(entity, id, data);
        } else {
          // Create new item
          await window.api.create(entity, data);
        }
      } else {
        // Fall back to localStorage for non-API data
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Storage.set error', e);
      // For API-backed entities, bubble the error so callers can show it
      if (entity) {
        throw e;
      }
      // Fall back to localStorage only for non-API data
      localStorage.setItem(key, value);
    }
  },

  async remove(key) {
    const entity = this.getEntityFromKey(key);
    try {
      if (entity) {
        const id = key.split('_')[1];
        await window.api.delete(entity, id);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Storage.remove error', e);
      if (entity) {
        throw e;
      }
      localStorage.removeItem(key);
    }
  },

  async list(prefix) {
    try {
      // Allow prefixes to be passed either with or without trailing underscore.
      // E.g., list('season') or list('season_') should both fetch the same entity.
      const normalizedPrefix = prefix.endsWith('_') ? prefix.slice(0, -1) : prefix;

      // Map prefix to entity (same as getEntityFromKey mappings)
      const entityMap = {
        'season': 'seasons',
        'grade': 'grades',
        'marketcenter': 'market-centers',
        'farmer': 'farmers',
        'inputtype': 'input-types',
        'issuedinput': 'issued-inputs',
        'salenumber': 'sale-numbers',
        'ticket': 'tickets',
        'pcn': 'pcns',
        'payment': 'payments',
        'ps': 'ps',
        'user': 'users'
      };
      const entity = entityMap[normalizedPrefix] || normalizedPrefix;
      const items = await window.api.getAll(entity);
      return {
        keys: items.map(item => `${normalizedPrefix}_${item.id}`),
        _items: items // Optimization: fast-path for useStorage bulk loading
      };
    } catch (e) {
      // Fall back to localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
      return { keys };
    }
  },

  getEntityFromKey(key) {
    // Handle both full keys (with ID) and prefix-only keys
    const mappings = {
      'season': 'seasons',
      'season_': 'seasons',
      'grade': 'grades',
      'grade_': 'grades',
      'marketcenter': 'market-centers',
      'marketcenter_': 'market-centers',
      'farmer': 'farmers',
      'farmer_': 'farmers',
      'inputtype': 'input-types',
      'inputtype_': 'input-types',
      'issuedinput': 'issued-inputs',
      'issuedinput_': 'issued-inputs',
      'salenumber': 'sale-numbers',
      'salenumber_': 'sale-numbers',
      'ticket': 'tickets',
      'ticket_': 'tickets',
      'pcn': 'pcns',
      'pcn_': 'pcns',
      'payment': 'payments',
      'payment_': 'payments',
      'ps': 'ps',
      'ps_': 'ps',
      'user': 'users',
      'user_': 'users'
    };

    for (const [prefix, entity] of Object.entries(mappings)) {
      if (key.startsWith(prefix)) {
        return entity;
      }
    }
    return null;
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
