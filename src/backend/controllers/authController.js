const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Busca o usuário no banco
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }

        // Compara a senha
        const senhaCorreta = await user.comparePassword(password);
        if (!senhaCorreta) {
            return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }

        // Gera o token JWT
        const token = jwt.sign(
            { 
                id:       user._id, 
                username: user.username, 
                role:     user.role,
                nome:     user.nome
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // Token válido por 8 horas (um dia de trabalho)
        );

        res.json({
            token,
            user: {
                id:         user._id,
                username:   user.username,
                role:       user.role,
                name:       user.nome,
                avatar_url: user.avatar_url,
                faction:    user.faction,
                xp:         user.xp,
                coins:      user.coins,
                level:      user.level,
                is_cursed:  user.is_cursed
            }
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: err.message });
    }
};

// POST /api/auth/register (usado pelo admin para criar usuários)
exports.register = async (req, res) => {
    try {
        const { username, password, nome, role, faction } = req.body;

        // Verifica se o usuário já existe
        const existe = await User.findOne({ username });
        if (existe) {
            return res.status(400).json({ message: 'Usuário já existe.' });
        }

        const user = new User({ username, password, nome, role, faction });
        await user.save();

        res.status(201).json({ 
            message: 'Usuário criado com sucesso!',
            user: { id: user._id, username: user.username, nome: user.nome, role: user.role }
        });

    } catch (err) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: err.message });
    }
};