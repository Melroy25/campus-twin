// Secure Web Crypto AES-256-GCM and SHA-256 utility functions
const ENCRYPTION_ALGO = 'AES-GCM';
const SYSTEM_KEY = "CampusTwinAdminMasterKey123!";

// Derive key using PBKDF2
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt text with password
export async function encryptText(text, password) {
  try {
    if (!text) return '';
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGO,
        iv: iv
      },
      key,
      enc.encode(text)
    );
    
    // Combine salt, iv, and encrypted bytes
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Return as base64 string
    return btoa(String.fromCharCode.apply(null, combined));
  } catch (err) {
    console.error("Encryption failed:", err);
    throw err;
  }
}

// Decrypt text with password
export async function decryptText(ciphertext, password) {
  try {
    if (!ciphertext) return '';
    const combined = new Uint8Array(
      atob(ciphertext)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGO,
        iv: iv
      },
      key,
      encrypted
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Incorrect cabinet password.");
  }
}

// Hash password locally for verification (SHA-256)
export async function hashPassword(password) {
  try {
    const enc = new TextEncoder();
    const msgBuffer = enc.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error("Hashing failed:", err);
    throw err;
  }
}

// Encrypt raw cabinet password with system master key for recovery backup
export async function encryptPasswordWithSystemKey(plainPassword) {
  return await encryptText(plainPassword, SYSTEM_KEY);
}

// Decrypt raw cabinet password with system master key for recovery retrieval
export async function decryptPasswordWithSystemKey(encryptedPassword) {
  return await decryptText(encryptedPassword, SYSTEM_KEY);
}
