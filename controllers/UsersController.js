import crypto from 'crypto';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body || {};

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const users = dbClient.db.collection('users');
    const existing = await users.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Already exist' });

    const hashed = crypto.createHash('sha1').update(password).digest('hex');
    const result = await users.insertOne({ email, password: hashed });

    return res.status(201).json({ id: result.insertedId.toString(), email });
  }
}

export default UsersController;
