import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mongodb from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = mongodb;

class FilesController {
  static async _getAuthUserId(req) {
    const token = req.header('X-Token') || '';
    if (!token) return null;
    if (!redisClient.isAlive()) return null;
    const withTimeout = (p, ms = 1500) => Promise.race(
      [p, new Promise((r) => setTimeout(() => r(null), ms))],
    );
    const userId = await withTimeout(redisClient.get(`auth_${token}`));
    return userId || null;
  }

  static _serialize(doc) {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      name: doc.name,
      type: doc.type,
      isPublic: Boolean(doc.isPublic),
      parentId: doc.parentId === 0 ? 0 : doc.parentId.toString(),
    };
  }

  static async postUpload(req, res) {
    const userId = await FilesController._getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!dbClient.isAlive()) return res.status(500).json({ error: 'Server error' });

    const users = dbClient.db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    const files = dbClient.db.collection('files');

    if (parentId !== 0) {
      let parent;
      try {
        parent = await files.findOne({ _id: new ObjectId(parentId) });
      } catch (e) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileDoc = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic: Boolean(isPublic),
      parentId: parentId === 0 ? 0 : new ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await files.insertOne(fileDoc);
      return res.status(201).json({
        id: result.insertedId.toString(), userId, name, type, isPublic: Boolean(isPublic), parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const localPath = path.join(folderPath, uuidv4());
    const content = Buffer.from(data, 'base64');
    await fs.promises.writeFile(localPath, content);

    fileDoc.localPath = localPath;

    const result = await files.insertOne(fileDoc);

    return res.status(201).json({
      id: result.insertedId.toString(), userId, name, type, isPublic: Boolean(isPublic), parentId,
    });
  }

  static async getShow(req, res) {
    const userId = await FilesController._getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(404).json({ error: 'Not found' });

    try {
      const file = await dbClient.db.collection('files').findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(userId),
      });
      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(FilesController._serialize(file));
    } catch (e) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async getIndex(req, res) {
    const userId = await FilesController._getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentIdRaw = req.query.parentId !== undefined ? String(req.query.parentId) : '0';
    const pageNum = Number(req.query.page);
    const page = Number.isNaN(pageNum) ? 0 : Math.max(0, pageNum);
    const limit = 20;

    let parentFilter;
    if (parentIdRaw === '0') {
      parentFilter = 0;
    } else if (ObjectId.isValid(parentIdRaw)) {
      parentFilter = new ObjectId(parentIdRaw);
    } else {
      return res.status(200).json([]);
    }

    try {
      const cursor = dbClient.db.collection('files')
        .find({ userId: new ObjectId(userId), parentId: parentFilter })
        .sort({ _id: 1 })
        .skip(page * limit)
        .limit(limit);
      const docs = await cursor.toArray();
      return res.status(200).json(docs.map((d) => FilesController._serialize(d)));
    } catch (e) {
      return res.status(200).json([]);
    }
  }
}

export default FilesController;
