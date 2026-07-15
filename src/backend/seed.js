require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

const users = [
  {
    username: 'admin',
    password: '123',
    nome: 'Mestre da Guilda',
    role: 'admin',
    avatar_url: 'assets/imgs/caneca_pixel.jpg',
    faction: 'QA',
    xp: 0, coins: 100, level: 1, is_cursed: false
  },
  {
    username: 'funcionario',
    password: '123',
    nome: 'Aventureiro QA',
    role: 'adventurer',
    avatar_url: 'assets/imgs/caneta_pixel.jpg',
    faction: 'QA',
    xp: 0, coins: 100, level: 1, is_cursed: false
  }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado ao MongoDB');

  for (const data of users) {
    await User.deleteOne({ username: data.username });
    await User.create(data);
    console.log(`Usuário criado: ${data.username}`);
  }

  console.log('Seed concluído!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
