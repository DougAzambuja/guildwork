// Middleware global de erro — captura qualquer erro não tratado nos controllers
// e formata logs detalhados com rota, payload e mapeamento de falhas de validação.
module.exports = (err, req, res, next) => {
    const timestamp  = new Date().toISOString();
    const statusCode = err.statusCode || err.status || 500;

    const logEntry = {
        timestamp,
        level:      statusCode >= 500 ? 'error' : 'warn',
        method:     req.method,
        path:       req.originalUrl,
        statusCode,
        error:      err.message,
        body:       req.body,
        params:     req.params,
        query:      req.query,
        user:       req.user ? { id: req.user.id, role: req.user.role } : null,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };

    statusCode >= 500
        ? console.error(JSON.stringify(logEntry, null, 2))
        : console.warn(JSON.stringify(logEntry, null, 2));

    // Mongoose: erro de validação de schema
    if (err.name === 'ValidationError') {
        const fields = Object.entries(err.errors).map(([field, e]) => ({
            field,
            message: e.message,
            value:   e.value,
            kind:    e.kind,
        }));
        return res.status(400).json({ message: 'Erro de validação.', fields });
    }

    // Mongoose: chave duplicada (unique)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'campo';
        return res.status(409).json({
            message: `Valor duplicado para o campo: ${field}.`,
            field,
            value:   err.keyValue?.[field],
        });
    }

    // JWT inválido ou expirado
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }

    res.status(statusCode).json({
        message: err.message || 'Erro interno do servidor.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
