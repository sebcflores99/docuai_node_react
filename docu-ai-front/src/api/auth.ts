import { apiRequest, setToken } from './client';
import type { AuthResponse, User } from '../types';

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
  });
}

export function fetchMe(): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/auth/me');
}

export function logout(): void {
  setToken(null);
}
