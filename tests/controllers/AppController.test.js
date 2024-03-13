#!/usr/bin/node


import dbClient from '../../utils/db';

describe('+ AppController', () => {
  before(async function () {
    this.timeout(10000);
    await clearCollections();
  });

  describe('+ GET: /status', () => {
    it('+ Services are online', async function () {
      const res = await request.get('/status');
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.eql({ redis: true, db: true });
    });
  });

  describe('+ GET: /stats', () => {
    it('+ Correct statistics about db collections', async function () {
      const res = await request.get('/stats');
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.eql({ users: 0, files: 0 });
    });

    it('+ Correct statistics about db collections [alt]', async function () {
      this.timeout(10000);
      await dbClient.usersCollection().insertMany([{ email: 'john@mail.com' }]);
      await dbClient.filesCollection().insertMany([
        { name: 'foo.txt', type: 'file' },
        { name: 'pic.png', type: 'image' },
      ]);

      const res = await request.get('/stats');
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.eql({ users: 1, files: 2 });
    });
  });
});

async function clearCollections() {
  try {
    const [usersCollection, filesCollection] = await Promise.all([
      dbClient.usersCollection(),
      dbClient.filesCollection(),
    ]);

    await Promise.all([
      usersCollection.deleteMany({}),
      filesCollection.deleteMany({}),
    ]);
  } catch (error) {
    throw new Error('Failed to clear collections');
  }
}
