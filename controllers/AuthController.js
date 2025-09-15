import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    const auth = req.header('Authorization') || '';
    if (!auth.startsWith('Basic ')) return res.status(401).json({ error: 'Unauthorized' });

    const base64 = auth.slice(6);
    let decoded = '';
    try {
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const sep = decoded.indexOf(':');
    if (sep === -1) return res.status(401).json({ error: 'Unauthorized' });

    const email = decoded.slice(0, sep);
    const password = decoded.slice(sep + 1);
    const hashed = crypto.createHash('sha1').update(password).digest('hex');

    const users = dbClient.db.collection('users');
    const user = await users.findOne({ email, password: hashed });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 24 * 3600);

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token') || '';
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await redisClient.del(key);
    return res.status(204).send();
  }
}

export default AuthController;
