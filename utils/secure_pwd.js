const bcrypt = require("bcrypt");
const crypto = require("crypto");

const algorithm = "aes-256-cbc";

const initVector = "4185296385296371";
const securityKey = "37418529638529637418522222222222";

const securePassword = async (password) => {
  const cipher = await crypto.createCipheriv(
    algorithm,
    securityKey,
    initVector
  );
  let encryptedData = await cipher.update(password, "utf-8", "hex");

  encryptedData += await cipher.final("hex");

  return encryptedData;
};

const comparePassword = async (password, dbPassword) => {
  let originalPwd = await decryptPassword(dbPassword);

  if (originalPwd == password) {
    return true;
  } else {
    return false;
  }
};

const decryptPassword = async (password) => {
  const decipher = crypto.createDecipheriv(algorithm, securityKey, initVector);
  let decryptedData = decipher.update(password, "hex", "utf-8");

  decryptedData += decipher.final("utf8");

  return decryptedData;
};

// 🔹 Encrypt Message (Random IV)
const encryptMessage = (message) => {
  const iv = crypto.randomBytes(16); // Generate a unique IV
  const cipher = crypto.createCipheriv(algorithm, securityKey, iv);

  let encryptedData = cipher.update(message, "utf-8", "hex");
  encryptedData += cipher.final("hex");

  // Store IV with the encrypted message
  return `${iv.toString("hex")}:${encryptedData}`;
};

// 🔹 Decrypt Message (Retrieve IV)
const decryptMessage = (password) => {
  try {
    const decipher = crypto.createDecipheriv(algorithm, securityKey, initVector);
    let decryptedData = decipher.update(password, "hex", "utf-8");
  
    decryptedData += decipher.final("utf8");
  
    return decryptedData;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return null;
  }
};


module.exports = {
  securePassword,
  comparePassword,
  decryptPassword,
  encryptMessage,
  decryptMessage,
};
