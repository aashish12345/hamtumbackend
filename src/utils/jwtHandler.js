const jwt = require("jsonwebtoken");

const secretKey =
  process.env.JSON_WEB_TOKEN_SECRET_KEY || "npk@$%#^&*()_+!@#$kpsnkl1239_+!@#$";
const timePeriod = process.env.JSON_WEB_TOKEN_SESSION_EXPIRE || "90d";
const getJwtToken = async (phone_no) => {
  try {
    const token = await jwt.sign(
      { phone_no },
      secretKey,
      { expiresIn: timePeriod }
    );
    return token;
  } catch (err) {
    throw err;
  }
};

const verifyJwtToken = async (token) => {
  try {
    await jwt.verify(token, secretKey);
    return true;
  } catch (err) {
    return false;
  }
};

const deleteJwtToken = async (phone_no) => {
  // Since JWTs are stateless, they cannot be deleted from the server side.
  // To "delete" a JWT, you can implement a token blacklist or change the secret key.
  // Here, we will simulate deletion by adding the token to a blacklist.
  // This is a simple in-memory blacklist. In a real application, use a persistent storage.
  const tokenBlacklist = [];
  const token = await getJwtToken(phone_no);
  tokenBlacklist.push(token);
  return true;
};

module.exports = {
  getJwtToken,
  verifyJwtToken,
  deleteJwtToken,
};
