import Queue from 'bull';
import fs from 'fs';
import mongodb from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const { ObjectId } = mongodb;
const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data || {};
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  if (!dbClient.isAlive()) throw new Error('DB not connected');

  const files = dbClient.db.collection('files');
  const doc = await files.findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
  if (!doc) throw new Error('File not found');
  if (!doc.localPath) throw new Error('File not found');

  const sizes = [500, 250, 100];

  await Promise.all(
    sizes.map(async (w) => {
      const buffer = await imageThumbnail(doc.localPath, { width: w });
      await fs.promises.writeFile(`${doc.localPath}_${w}`, buffer);
    }),
  );
});
