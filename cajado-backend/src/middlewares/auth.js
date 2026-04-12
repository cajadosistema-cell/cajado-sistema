const jwt = require("jsonwebtoken");
const { JWT_SECRET, ADMIN_EMAIL } = require("../config/env");

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ erro: "Token obrigatório" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido" });
  }
}

function isSuperAdmin(user) {
  const adminEmail = (ADMIN_EMAIL || "admin@visiopro.com").toLowerCase();
  return user?.email?.toLowerCase() === adminEmail;
}

function superAdminMiddleware(req, res, next) {
  if (!isSuperAdmin(req.user)) return res.status(403).json({ erro: "Acesso restrito ao super admin" });
  next();
}

module.exports = { authMiddleware, isSuperAdmin, superAdminMiddleware };
