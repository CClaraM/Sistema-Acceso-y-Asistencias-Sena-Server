import jwt from "jsonwebtoken";

const ACCESS_TIME = "15m";
const REFRESH_TIME = "7d";

export const TokenService = {

  // ╔══════════════════════════════════╗
  // ║     TOKENS PARA DISPOSITIVOS     ║
  // ╚══════════════════════════════════╝

  signAccessToken(deviceId, deviceSecret) {
    return jwt.sign(
      {
        sub: deviceId,
        type: "access",
      },
      deviceSecret, // ← secreto único del dispositivo
      { expiresIn: ACCESS_TIME }
    );
  },

  signRefreshToken(deviceId, deviceSecret) {
    return jwt.sign(
      {
        sub: deviceId,
        type: "refresh",
      },
      deviceSecret, // ← secreto único del dispositivo
      { expiresIn: REFRESH_TIME }
    );
  },

  // Decodificar sin verificar (se usa en el middleware)
  decode(token) {
    return jwt.decode(token);
  },

  // Verificar token del dispositivo con su secreto
  verifyDeviceToken(token, deviceSecret) {
    return jwt.verify(token, deviceSecret);
  },

  // ╔══════════════════════════════════╗
  // ║   TOKENS PARA USUARIOS HUMANOS   ║
  // ╚══════════════════════════════════╝

  signUserToken(userId, role, userRolId) {
    return jwt.sign(
      {
        sub: userId,
        role,
        userRolId,
        type: "user",
      },
      process.env.JWT_SECRET, // ← único global
      { expiresIn: "2h" }
    );
  },

  verifyUserToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  },
};


/*import jwt from "jsonwebtoken";

const ACCESS_TIME = "15m";
const REFRESH_TIME = "7d";

export const TokenService = {
  signAccessToken(deviceId) {
    return jwt.sign(
      {
        sub: deviceId,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TIME }
    );
  },

  signRefreshToken(deviceId) {
    return jwt.sign(
      {
        sub: deviceId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: REFRESH_TIME }
    );
  },

  signUserToken(userId, role) {
    return jwt.sign(
      { sub: userId, role, type: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );
  },
  
  verify(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
};
*/