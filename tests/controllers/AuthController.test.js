#!/usr/bin/node

import dbClient from '../../utils/db';

describe('+ AuthController', () => {
  const mockUser = {
    email: 'kaido@beast.com',
    password: 'hyakuju_no_kaido_wano',
  };
  let token = '';

  before(async function () {
    this.timeout(10000);
    await setupMockUser();
  });

  describe('+ GET: /connect', () => {
    it('+ Fails with no "Authorization" header field', async function () {
      const res = await request.get('/connect');
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Fails for a non-existent user', async function () {
      const res = await request
        .get('/connect')
        .auth('foo@bar.com', 'raboof', { type: 'basic' });
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Fails with a valid email and wrong password', async function () {
      const res = await request
        .get('/connect')
        .auth(mockUser.email, 'raboof', { type: 'basic' });
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Fails with an invalid email and valid password', async function () {
      const res = await request
        .get('/connect')
        .auth('zoro@strawhat.com', mockUser.password, { type: 'basic' });
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Succeeds for an existing user', async function () {
      const res = await request
        .get('/connect')
        .auth(mockUser.email, mockUser.password, { type: 'basic' });
      expect(res.status).to.equal(200);
      expect(res.body.token).to.exist;
      expect(res.body.token.length).to.be.greaterThan(0);
      token = res.body.token;
    });
  });

  describe('+ GET: /disconnect', () => {
    it('+ Fails with no "X-Token" header field', async function () {
      const res = await request.get('/disconnect');
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Fails for a non-existent user', async function () {
      const res = await request
        .get('/disconnect')
        .set('X-Token', 'raboof');
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.eql({ error: 'Unauthorized' });
    });

    it('+ Succeeds with a valid "X-Token" field', async function () {
      const res = await request
        .get('/disconnect')
        .set('X-Token', token);
      expect(res.status).to.equal(204);
      expect(res.body).to.deep.eql({});
      expect(res.text).to.eql('');
      expect(res.headers['content-type']).to.not.exist;
      expect(res.headers['content-length']).to.not.exist;
    });
  });

  async function setupMockUser() {
    try {
      const usersCollection = await dbClient.usersCollection();
      await usersCollection.deleteMany({ email: mockUser.email });
      const res = await request
        .post('/users')
        .send({ email: mockUser.email, password: mockUser.password });
      expect(res.status).to.equal(201);
      expect(res.body.email).to.eql(mockUser.email);
      expect(res.body.id.length).to.be.greaterThan(0);
    } catch (error) {
      throw new Error('Failed to setup mock user');
    }
  }
});
