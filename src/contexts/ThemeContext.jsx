import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const themes = {
  default: {
    name: 'default',
    colors: {
      // Primary colors
      primary: '#06b6d4', // Cyan-500
      primaryDark: '#0891b2', // Cyan-600
      primaryLight: '#22d3ee', // Cyan-400
      secondary: '#14b8a6', // Teal-500
      secondaryDark: '#0d9488', // Teal-600
      secondaryLight: '#2dd4bf', // Teal-400
      
      // Background
      bg: '#0a0a0a',
      bgAccent: '#1a1a1a',
      
      // Borders
      border: 'rgba(6, 182, 212, 0.3)',
      borderHover: 'rgba(6, 182, 212, 0.6)',
      borderLight: 'rgba(6, 182, 212, 0.2)',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: '#e5e7eb',
      textTertiary: '#9ca3af',
      
      // Gradients
      gradientFrom: '#0891b2', // Cyan-600
      gradientTo: '#0d9488', // Teal-600
      gradientVia: '#06b6d4', // Cyan-500
      
      // Shadows
      shadow: 'rgba(6, 182, 212, 0.5)',
      shadowHover: 'rgba(6, 182, 212, 0.6)',
      
      // Mesh background
      mesh1: 'rgba(6, 182, 212, 0.15)',
      mesh2: 'rgba(20, 184, 166, 0.15)',
      mesh3: 'rgba(8, 145, 178, 0.12)',
      mesh4: 'rgba(6, 182, 212, 0.15)',
    }
  },
  excelr8: {
    name: 'excelr8',
    colors: {
      // Primary colors - Deep Purple/Indigo (dominant brand color)
      primary: '#6366F1', // Indigo-500 (Deep Purple/Indigo)
      primaryDark: '#4F46E5', // Indigo-600 (darker purple)
      primaryLight: '#818CF8', // Indigo-400 (lighter purple)
      secondary: '#06B6D4', // Cyan-500 (Electric Blue/Cyan - secondary accent)
      secondaryDark: '#0891B2', // Cyan-600
      secondaryLight: '#22D3EE', // Cyan-400
      
      // Background - Pure Black foundation
      bg: '#000000', // Pure black as per Excelr8 website
      bgAccent: '#0a0a0a', // Slightly lighter for cards (almost black)
      
      // Borders
      border: 'rgba(99, 102, 241, 0.3)', // Indigo with transparency
      borderHover: 'rgba(99, 102, 241, 0.6)',
      borderLight: 'rgba(99, 102, 241, 0.2)',
      
      // Text - White/Off-white
      textPrimary: '#ffffff', // Pure white for primary text
      textSecondary: '#f3f4f6', // Off-white for secondary text
      textTertiary: '#d1d5db', // Light gray for tertiary text
      
      // Gradients - Purple-to-blue gradients (heavily used)
      gradientFrom: '#6366F1', // Indigo-500 (Deep Purple)
      gradientTo: '#06B6D4', // Cyan-500 (Electric Blue)
      gradientVia: '#818CF8', // Indigo-400 (transition color)
      
      // Shadows
      shadow: 'rgba(99, 102, 241, 0.5)', // Purple shadow
      shadowHover: 'rgba(6, 182, 212, 0.6)', // Cyan shadow on hover
      
      // Mesh background - Purple and blue gradients
      mesh1: 'rgba(99, 102, 241, 0.15)', // Deep Purple
      mesh2: 'rgba(6, 182, 212, 0.15)', // Electric Blue/Cyan
      mesh3: 'rgba(79, 70, 229, 0.12)', // Darker Purple
      mesh4: 'rgba(99, 102, 241, 0.15)', // Deep Purple
    }
  },
  testTheme1: {
    name: 'testTheme1',
    colors: {
      // Primary colors - Purple/Violet (modern, AI-focused)
      primary: '#8b5cf6', // Purple-500
      primaryDark: '#7c3aed', // Purple-600
      primaryLight: '#a855f7', // Purple-400
      secondary: '#ec4899', // Pink-500
      secondaryDark: '#db2777', // Pink-600
      secondaryLight: '#f472b6', // Pink-400
      
      // Background
      bg: '#0a0a0a',
      bgAccent: '#1a1a1a',
      
      // Borders
      border: 'rgba(139, 92, 246, 0.3)',
      borderHover: 'rgba(139, 92, 246, 0.6)',
      borderLight: 'rgba(139, 92, 246, 0.2)',
      
      // Text
      textPrimary: '#ffffff',
      textSecondary: '#e5e7eb',
      textTertiary: '#9ca3af',
      
      // Gradients
      gradientFrom: '#8b5cf6', // Purple-500
      gradientTo: '#ec4899', // Pink-500
      gradientVia: '#a855f7', // Purple-400
      
      // Shadows
      shadow: 'rgba(139, 92, 246, 0.5)',
      shadowHover: 'rgba(139, 92, 246, 0.6)',
      
      // Mesh background
      mesh1: 'rgba(139, 92, 246, 0.15)',
      mesh2: 'rgba(236, 72, 153, 0.15)',
      mesh3: 'rgba(124, 58, 237, 0.12)',
      mesh4: 'rgba(139, 92, 246, 0.15)',
    }
  },
  excelr82: {
    name: 'excelr82',
    colors: {
      // Primary colors - Electric Green (bright vibrant lime green)
      primary: '#CCFF00', // Electric Green - Accent 1 (bright vibrant lime green)
      primaryDark: '#7ED321', // Accent 3 (darker, more saturated green)
      primaryLight: '#9AE62E', // Accent 2 (slightly less vibrant, medium-light green)
      secondary: '#5FB810', // Link color (medium green)
      secondaryDark: '#4A9A0D', // Darker green variant
      secondaryLight: '#B8FF33', // Lighter electric green
      
      // Background - White foundation
      bg: '#FFFFFF', // Pure white background
      bgAccent: '#F8F8F8', // Light gray for cards (GRAY 100)
      
      // Borders - Electric green with transparency
      border: 'rgba(204, 255, 0, 0.3)', // Electric green border
      borderHover: 'rgba(204, 255, 0, 0.6)',
      borderLight: 'rgba(204, 255, 0, 0.2)',
      
      // Text - Black on white background
      textPrimary: '#000000', // Black text on white background
      textSecondary: '#4A4A4A', // Dark gray (GRAY 700)
      textTertiary: '#6B6B6B', // Medium gray (GRAY 600)
      
      // Gradients - Electric green gradients
      gradientFrom: '#CCFF00', // Electric Green - Accent 1
      gradientTo: '#7ED321', // Accent 3 (darker green)
      gradientVia: '#9AE62E', // Accent 2 (medium-light green)
      
      // Shadows - Electric green glow
      shadow: 'rgba(204, 255, 0, 0.3)', // Electric green shadow
      shadowHover: 'rgba(204, 255, 0, 0.5)', // Electric green glow
      
      // Mesh background - Subtle green gradients
      mesh1: 'rgba(204, 255, 0, 0.08)', // Electric green (very subtle)
      mesh2: 'rgba(154, 230, 46, 0.08)', // Accent 2 (very subtle)
      mesh3: 'rgba(126, 211, 33, 0.06)', // Accent 3 (very subtle)
      mesh4: 'rgba(204, 255, 0, 0.08)', // Electric green (very subtle)
    }
  },
  upwork: {
    name: 'upwork',
    colors: {
      // Primary colors - Upwork Green
      primary: '#73BB44', // Primary Green - Upwork's main brand color
      primaryDark: '#385925', // Dark Green
      primaryLight: '#8CCC8C', // Light Green
      secondary: '#4FAB4A', // Secondary Green
      secondaryDark: '#385925', // Dark Green
      secondaryLight: '#8CCC8C', // Light Green
      
      // Background - White foundation (Upwork uses clean white backgrounds)
      bg: '#FFFFFF', // Pure white background
      bgAccent: '#F5F5F5', // Light gray for cards
      
      // Borders - Upwork green with transparency
      border: 'rgba(115, 187, 68, 0.3)', // Upwork green border
      borderHover: 'rgba(115, 187, 68, 0.6)',
      borderLight: 'rgba(115, 187, 68, 0.2)',
      
      // Text - Dark gray on white background (Upwork's text color)
      textPrimary: '#4C4444', // Dark Gray - Upwork's text color
      textSecondary: '#6B6B6B', // Medium gray
      textTertiary: '#808080', // Light gray
      
      // Gradients - Upwork green gradients
      gradientFrom: '#73BB44', // Primary Green
      gradientTo: '#4FAB4A', // Secondary Green
      gradientVia: '#8CCC8C', // Light Green
      
      // Shadows - Upwork green glow
      shadow: 'rgba(115, 187, 68, 0.3)', // Upwork green shadow
      shadowHover: 'rgba(115, 187, 68, 0.5)', // Upwork green glow
      
      // Mesh background - Subtle green gradients
      mesh1: 'rgba(115, 187, 68, 0.08)', // Primary green (very subtle)
      mesh2: 'rgba(79, 171, 74, 0.08)', // Secondary green (very subtle)
      mesh3: 'rgba(140, 204, 140, 0.06)', // Light green (very subtle)
      mesh4: 'rgba(115, 187, 68, 0.08)', // Primary green (very subtle)
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Load from localStorage or default to 'default'
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme && themes[savedTheme] ? savedTheme : 'default';
  });

  useEffect(() => {
    // Apply theme to document root
    const theme = themes[currentTheme];
    const root = document.documentElement;
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
    
    // Set data attribute for CSS targeting
    root.setAttribute('data-theme', currentTheme);
    
    // Save to localStorage
    localStorage.setItem('app-theme', currentTheme);
  }, [currentTheme]);

  const setTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
    }
  };

  const value = {
    currentTheme,
    setTheme,
    theme: themes[currentTheme],
    themes: Object.keys(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

