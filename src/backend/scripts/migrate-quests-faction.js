/**
 * Migração única: define faction='Produto' em todas as quests que ainda não têm faction.
 * Uso: node src/backend/scripts/migrate-quests-faction.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Quest    = require('../models/quest');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB.');

    const result = await Quest.updateMany(
        { faction: { $exists: false } },
        { $set: { faction: 'Produto' } }
    );

    console.log(`Quests atualizadas: ${result.modifiedCount}`);
    await mongoose.disconnect();
    console.log('Concluído.');
}

run().catch(err => {
    console.error('Erro na migração:', err.message);
    process.exit(1);
});
