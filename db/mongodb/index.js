'use strict';

require('dotenv').config();
const { MongoClient } = require('mongodb');


let db;

/**
 * Get MongoDB collection object
 * @param {string} name - collection name
 * @returns {Promise<Collection>} A Promise that resolves to the collection object
 */
exports.getMongodbCollection = async (name) => {
    console.log('name',name);
    if (db) {
        return db.collection(name);
    } else {
        const client = await MongoClient.connect(process.env.MONGODB_URL, { useNewUrlParser: true });
        db = client.db(process.env.MONGODB_DB);
        return db.collection(name);
    }
};








