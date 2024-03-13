#!/usr/bin/node


import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';

const userQueue = new Queue('email sending');

export default class UsersController {
  /**
   * Creates a new user.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async postNew(req, res) {
    try {
      const { email, password } = req.body;

      // Input validation
      if (!email) {
        res.status(400).json({ error: 'Missing email' });
        return;
      }
      if (!password) {
        res.status(400).json({ error: 'Missing password' });
        return;
      }

      // Check if user already exists
      const user = await dbClient.usersCollection().findOne({ email });
      if (user) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }

      // Insert new user into database
      const insertionInfo = await dbClient.usersCollection().insertOne({
        email,
        password: sha1(password),
      });
      const userId = insertionInfo.insertedId.toString();

      // Add user to email sending queue
      userQueue.add({ userId });

      res.status(201).json({ email, id: userId });
    } catch (error) {
      console.error('Error creating new user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Retrieves the current user's information.
   * @param {Request} req The Express request object.
   * @param {Response} res The Express response object.
   */
  static async getMe(req, res) {
    try {
      const { user } = req;
      res.status(200).json({ email: user.email, id: user._id.toString() });
    } catch (error) {
      console.error('Error fetching user information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
