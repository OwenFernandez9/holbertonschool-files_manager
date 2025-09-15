import crypto from 'crypto';
import mongodb from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = mongodb;

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

  static async getMe(req, res) {
    const token = req.header('X-Token') || '';
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const users = dbClient.db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(200).json({ id: user._id.toString(), email: user.email });
  }
}

export default UsersController;
