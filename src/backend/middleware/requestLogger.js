// Middleware de log de requisições — registra método, rota, status e latência.
// Erros (4xx/5xx) incluem body e params para facilitar debug.
module.exports = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const ms  = Date.now() - start;
        const log = {
            timestamp:  new Date().toISOString(),
            method:     req.method,
            path:       req.originalUrl,
            statusCode: res.statusCode,
            duration:   `${ms}ms`,
            user:       req.user ? { id: req.user.id, role: req.user.role } : null,
        };

        if (res.statusCode >= 400) {
            Object.assign(log, { body: req.body, params: req.params, query: req.query });
            console.error(JSON.stringify(log));
        } else {
            console.log(JSON.stringify(log));
        }
    });

    next();
};
