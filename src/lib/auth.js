// Simple authentication utility
// Password: admin123
// Hash: SHA-256 hash (computed and logged to console)

// Hash the password using Web Crypto API
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

// Get credentials from environment variables
const ADMIN_USERNAME = (import.meta.env.VITE_ADMIN_USERNAME || 'admin').trim();
const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH 
  ? import.meta.env.VITE_ADMIN_PASSWORD_HASH.trim().replace(/\s+/g, '')
  : null;

// Valid credentials
const VALID_CREDENTIALS = {
  username: ADMIN_USERNAME,
  passwordHash: ADMIN_PASSWORD_HASH
};

// Debug logging on module load
console.log('🔐 Auth Module Loaded:');
console.log('  - ADMIN_USERNAME:', ADMIN_USERNAME);
console.log('  - ADMIN_PASSWORD_HASH:', ADMIN_PASSWORD_HASH ? 'SET' : 'NOT SET');

// Check if credentials are valid
export const verifyCredentials = async (username, password) => {
  // Check username
  const usernameMatch = username.trim().toLowerCase() === VALID_CREDENTIALS.username.toLowerCase();
  if (!usernameMatch) {
    return false;
  }

  // Hash the provided password
  const passwordHash = await hashPassword(password);
  
  // Print the computed hash to console so user can copy it
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 COPY THIS HASH TO YOUR .env FILE:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`VITE_ADMIN_PASSWORD_HASH=${passwordHash}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  // Check if environment variables are configured
  if (!ADMIN_PASSWORD_HASH) {
    console.warn('⚠️  VITE_ADMIN_PASSWORD_HASH not set in .env - using computed hash for this session');
    console.warn('   Copy the hash above to your .env file and restart the server');
    // Allow login if hash is not set (for first-time setup)
    return true;
  }

  // Compare with stored hash from .env
  const hashMatch = passwordHash === ADMIN_PASSWORD_HASH;
  
  if (!hashMatch) {
    console.log('❌ Hash mismatch!');
    console.log('   Computed:', passwordHash);
    console.log('   Stored:  ', ADMIN_PASSWORD_HASH);
    console.log('   Make sure you copied the exact hash above to your .env file');
  } else {
    console.log('✅ Hash matches! Authentication successful.');
  }
  
  return hashMatch;
};

// Create session (12 hours)
export const createSession = (username) => {
  const session = {
    isAuthenticated: true,
    username: username,
    expiresAt: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
  };
  localStorage.setItem('auth_session', JSON.stringify(session));
  return session;
};

// Check if session is valid
export const isSessionValid = () => {
  try {
    const sessionStr = localStorage.getItem('auth_session');
    if (!sessionStr) return false;

    const session = JSON.parse(sessionStr);
    
    // Check if session exists and is authenticated
    if (!session.isAuthenticated) return false;
    
    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      clearSession();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking session:', error);
    return false;
  }
};

// Get current session
export const getSession = () => {
  try {
    const sessionStr = localStorage.getItem('auth_session');
    if (!sessionStr) return null;
    
    const session = JSON.parse(sessionStr);
    if (!isSessionValid()) return null;
    
    return session;
  } catch (error) {
    return null;
  }
};

// Clear session (logout)
export const clearSession = () => {
  localStorage.removeItem('auth_session');
};

// Login function
export const login = async (username, password) => {
  const isValid = await verifyCredentials(username, password);
  if (isValid) {
    createSession(username);
    return true;
  }
  return false;
};

// Logout function
export const logout = () => {
  clearSession();
};

