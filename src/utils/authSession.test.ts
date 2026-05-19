import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSession, saveSession, clearSession, clearLegacyAuth } from '../authSession';

// Auth session uses sessionStorage
const STORAGE_KEY = 'qlttb.auth';

describe('authSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('getSession', () => {
    it('should return null when no session exists', () => {
      expect(getSession()).toBeNull();
    });

    it('should return parsed session data', () => {
      const session = {
        username: 'admin',
        name: 'Admin',
        role: 'admin',
        email: 'admin@test.com',
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      const result = getSession();
      expect(result).not.toBeNull();
      expect(result?.username).toBe('admin');
      expect(result?.role).toBe('admin');
    });

    it('should return null for invalid JSON', () => {
      sessionStorage.setItem(STORAGE_KEY, 'not-json');
      expect(getSession()).toBeNull();
    });

    it('should return null for empty string', () => {
      sessionStorage.setItem(STORAGE_KEY, '');
      expect(getSession()).toBeNull();
    });
  });

  describe('saveSession', () => {
    it('should store session in sessionStorage', () => {
      saveSession({
        username: 'user1',
        name: 'Nguyễn Văn A',
        role: 'user',
        email: 'user1@hospital.vn',
      });
      const stored = sessionStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.username).toBe('user1');
      expect(parsed.name).toBe('Nguyễn Văn A');
    });
  });

  describe('clearSession', () => {
    it('should remove session from sessionStorage', () => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'test' }));
      clearSession();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('clearLegacyAuth', () => {
    it('should remove old auth keys', () => {
      // Set some legacy keys that should be cleaned up
      sessionStorage.setItem('auth', 'old-data');
      sessionStorage.setItem('user', 'old-user');
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username: 'current' }));

      clearLegacyAuth();

      // Legacy keys should be removed
      expect(sessionStorage.getItem('auth')).toBeNull();
      expect(sessionStorage.getItem('user')).toBeNull();
      // Current key should remain
      expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });
});
