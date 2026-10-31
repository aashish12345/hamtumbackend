const cryptoJS = require("crypto-js");
const constant = require("../constant");
// const key = cryptoJS.enc.Utf8.parse(process.env.PASSWORD_SECURE_KEY);
// const iv = cryptoJS.enc.Utf8.parse(process.env.PASSWORD_SECURE_MSG);
const key = cryptoJS.enc.Utf8.parse(constant.ENCDNC.CRYPTO_KEY.CRYPTO_KEY);
const iv = cryptoJS.enc.Utf8.parse(constant.ENCDNC.CRYPTO_IV.CRYPTO_IV);
const encryptParams = () => {
  return {
    keySize: 128,
    iv: iv,
    mode: cryptoJS.mode.ECB,
    padding: cryptoJS.pad.Pkcs7,
  };
};

const encryptData = (data) => {
  keyValue = cryptoJS.AES.encrypt(data, key, encryptParams()).toString();
  return keyValue;
};

const decryptData = (data) => {
  keyValue = cryptoJS.AES.decrypt(data, key, encryptParams()).toString(
    cryptoJS.enc.Utf8
  );
  return keyValue;
};
const comparePassword = (password1, password2) => {
  const decryptedPassword = decryptData(password2);
  return password1 === decryptedPassword;
};

module.exports = {
  encryptData,
  decryptData,
  encryptParams,
  comparePassword,
};
