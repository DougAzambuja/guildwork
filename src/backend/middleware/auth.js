const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Pega o token do header Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            message: 'Acesso negado. Token não fornecido.' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Injeta os dados do usuário na requisição
        next();
    } catch (err) {
        return res.status(403).json({ 
            message: 'Token inválido ou expirado.' 
        });
    }
};