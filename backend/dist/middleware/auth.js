"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const auth_1 = require("../services/auth");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: no token provided" });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = (0, auth_1.verifyToken)(token);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: "Unauthorized: invalid token" });
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            res.status(403).json({ error: "Forbidden: insufficient role" });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map