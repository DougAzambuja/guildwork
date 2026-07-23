const jwt     = require('jsonwebtoken');
const User    = require('../../models/user');
const Quest   = require('../../models/quest');
const Guild   = require('../../models/guild');
const Sprint  = require('../../models/sprint');
const LootItem = require('../../models/lootItem');
const Notification = require('../../models/notification');

const SECRET = () => process.env.JWT_SECRET;

function makeToken(user) {
    return jwt.sign(
        { id: user._id, username: user.username, role: user.role, nome: user.nome },
        SECRET(),
        { expiresIn: '1h' }
    );
}

async function createAdmin(overrides = {}) {
    const user = await User.create({
        username: `admin_${Date.now()}`,
        password: 'Admin@123',
        nome:     'Admin Teste',
        role:     'admin',
        faction:  'Produto',
        xp:       0,
        coins:    500,
        ...overrides,
    });
    return { user, token: makeToken(user) };
}

async function createPlayer(overrides = {}) {
    const user = await User.create({
        username: `player_${Date.now()}`,
        password: 'Player@123',
        nome:     'Player Teste',
        role:     'funcionario',
        faction:  'Produto',
        xp:       0,
        coins:    100,
        ...overrides,
    });
    return { user, token: makeToken(user) };
}

async function createQuest(overrides = {}) {
    return Quest.create({
        title:       'Quest de Teste',
        description: 'Descrição de teste',
        type:        'normal',
        xp_reward:   100,
        coin_reward: 10,
        faction:     'Produto',
        status:      'todo',
        ...overrides,
    });
}

async function createGuild(overrides = {}) {
    return Guild.create({
        name:        'Guilda Produto',
        faction_key: 'Produto',
        icon:        '⚔️',
        tax_rate:    0.10,
        ...overrides,
    });
}

async function createSprint(overrides = {}) {
    const now    = new Date();
    const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return Sprint.create({
        name:          'Sprint Teste',
        status:        'active',
        factions:      ['Produto'],
        start_date:    now,
        end_date:      future,
        duration_days: 14,
        ...overrides,
    });
}

async function createLootItem(adminId, overrides = {}) {
    return LootItem.create({
        name:        'Item Teste',
        price:       50,
        image:       'assets/imgs/caneca_pixel.jpg',
        is_cosmetic: false,
        created_by:  adminId,
        ...overrides,
    });
}

async function createNotification(userId, overrides = {}) {
    return Notification.create({
        user_id: userId,
        type:    'quest_assigned',
        title:   'Nova Missão',
        message: 'Você recebeu uma nova missão!',
        read:    false,
        ...overrides,
    });
}

module.exports = {
    createAdmin,
    createPlayer,
    createQuest,
    createGuild,
    createSprint,
    createLootItem,
    createNotification,
};
