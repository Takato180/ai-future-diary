'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { UserResponse, AuthResponse, UserCreate, UserLogin, registerUser, loginUser, getCurrentUser } from '@/lib/api';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: UserLogin) => Promise<void>;
  register: (userData: UserCreate) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // トークンをローカルストレージから取得
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // ユーザー情報を取得
      getCurrentUser(storedToken)
        .then(userData => {
          console.log('[DEBUG] User data loaded from token:', userData);
          setUser(userData);
        })
        .catch(error => {
          console.error('Failed to get user info:', error);
          // トークンが無効な場合はクリア
          localStorage.removeItem('auth_token');
          setToken(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleAuthResponse = (response: AuthResponse) => {
    console.log('[DEBUG] Auth response user data:', response.user);
    setUser(response.user);
    setToken(response.access_token);
    localStorage.setItem('auth_token', response.access_token);
  };

  const login = async (credentials: UserLogin) => {
    try {
      const response = await loginUser(credentials);
      handleAuthResponse(response);
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: UserCreate) => {
    try {
      const response = await registerUser(userData);
      handleAuthResponse(response);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    // Clear user data from localStorage
    if (user?.userId) {
      localStorage.removeItem(`taggedPlans_${user.userId}`);
      localStorage.removeItem(`savedTags_${user.userId}`);
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const refreshUser = async () => {
    if (!token) return;

    try {
      const userData = await getCurrentUser(token);
      console.log('[DEBUG] Refreshed user data:', userData);
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user info:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}