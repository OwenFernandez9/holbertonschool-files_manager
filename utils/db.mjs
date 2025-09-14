import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const dbName = process.env.DB_DATABASE || 'files_manager';

    this.dbName = dbName;
    this.connected = false;

    const uri = `mongodb://${host}:${port}`;

    this.client = new MongoClient(uri);
    this.db = null;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(this.dbName);
        this.connected = true;
      })
      .catch((err) => {
        console.error('MongoDB Client Error:', err);
      });
  }

  isAlive() {
    return this.connected === true;
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
