import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: any;
  login: (credentials: any) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for existing session on component mount
    const savedAuth = localStorage.getItem('auth');
    if (savedAuth) {
      try {
        const { isAuthenticated: savedIsAuth, isAdmin: savedIsAdmin, user: savedUser } = JSON.parse(savedAuth);
        setIsAuthenticated(savedIsAuth);
        setIsAdmin(savedIsAdmin);
        setUser(savedUser);
      } catch (error) {
        console.error('Error parsing saved auth:', error);
        localStorage.removeItem('auth');
      }
    }
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    try {
      // For demo purposes, use simple credentials check
      // In production, this would be a proper API call
      if (credentials.username === 'admin' && credentials.password === 'admin123') {
        const userData = {
          id: 1,
          username: 'admin',
          name: 'Administrator',
          role: 'admin'
        };
        
        setIsAuthenticated(true);
        setIsAdmin(true);
        setUser(userData);
        
        // Save to localStorage
        localStorage.setItem('auth', JSON.stringify({
          isAuthenticated: true,
          isAdmin: true,
          user: userData
        }));
        
        return true;
      } else if (credentials.username === 'user' && credentials.password === 'user123') {
        const userData = {
          id: 2,
          username: 'user',
          name: 'Regular User',
          role: 'user'
        };
        
        setIsAuthenticated(true);
        setIsAdmin(false);
        setUser(userData);
        
        // Save to localStorage
        localStorage.setItem('auth', JSON.stringify({
          isAuthenticated: true,
          isAdmin: false,
          user: userData
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUser(null);
    localStorage.removeItem('auth');
  };

  const value = {
    isAuthenticated,
    isAdmin,
    user,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};