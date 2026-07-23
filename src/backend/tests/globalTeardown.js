module.exports = async () => {
    if (global.__MONGOD__) {
        await global.__MONGOD__.stop();
        console.log('\n[Test] MongoDB in-memory encerrado.');
    }
};
