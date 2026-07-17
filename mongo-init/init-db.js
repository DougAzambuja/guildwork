db = db.getSiblingDB('guildwork');

db.createCollection('users');

db.users.deleteMany({ username: { $in: ['admin', 'funcionario'] } });

db.users.insertMany([
  {
    username: 'admin',
    nome: 'Mestre da Guilda',
    password: '$2a$10$O3VixsFYJL9sWDagKZ4.NuzajA.3oUA68s0zpSRPW7AuZF.SB7wae', // Hash padrão para '123'
    role: 'admin',
    xp: 0,
    coins: 0,
    level: 1,
    quests_completed: 0,
    is_cursed: false,
    avatar_url: 'assets/imgs/caneca_pixel.jpg'
  },
  {
    username: 'funcionario',
    nome: 'Aventureiro QA',
    password: '$2a$10$O3VixsFYJL9sWDagKZ4.NuzajA.3oUA68s0zpSRPW7AuZF.SB7wae', // Hash padrão para '123'
    role: 'funcionario',
    faction: 'Produto',
    xp: 0,
    coins: 0,
    level: 1,
    quests_completed: 0,
    is_cursed: false,
    avatar_url: 'assets/imgs/caneta_pixel.jpg'
  }
]);

print('🛡️ Usuários da Guilda atualizados com senhas criptografadas!');