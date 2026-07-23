const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
    const mongod = await MongoMemoryServer.create();
    global.__MONGOD__ = mongod;

    process.env.MONGODB_TEST_URI = mongod.getUri();
    process.env.JWT_SECRET       = 'guildwork-test-secret-key-2024';
    process.env.NODE_ENV         = 'test';

    console.log('\n[Test] MongoDB in-memory iniciado:', process.env.MONGODB_TEST_URI);
};
