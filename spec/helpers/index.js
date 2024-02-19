'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { getMongodbCollection } = require('../../db/mongodb');
const existingVoucherDocuments = [];
const existingRedemptionDocuments = [];
const existingPassesDocuments = [];
const existingBalanceAccountDocuments = [];
const Promise = require('bluebird');
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

chai.use(chaiAsPromised);

exports.API_URL = process.env.FUNCTION_STAGING_URL || 'http://localhost:7073';

exports.saveExistingDocuments = async collectionName => {
    existingVoucherDocuments.length = 0;
    existingRedemptionDocuments.length = 0;
    existingPassesDocuments.length = 0;
    existingBalanceAccountDocuments.length = 0;
    const collection = await getMongodbCollection(collectionName);
    const result = await Promise.all([
        collection.find({ docType: 'vouchers' }).toArray(),
        collection.find({ docType: 'redemption' }).toArray(),
        collection.find({ docType: 'passes' }).toArray(),
        collection.find({ docType: 'balanceAccount' }).toArray(),
    ]);
    existingVoucherDocuments.push(...result[0]);
    existingRedemptionDocuments.push(...result[1]);
    existingPassesDocuments.push(...result[2]);
    existingBalanceAccountDocuments.push(...result[3]);

    await this.removeTestDocuments(collectionName);
};

// exports.getMessageFromAzureBus = (topic, subscription) => {
//     if (topic && subscription) {
//         return new Promise((resolve, reject) => {
//             serviceBusClient.receiveSubscriptionMessage(topic, subscription, (error, message) => {
//                 if (error) {
//                     reject(error);
//                 } else {
//                     resolve(message.body);
//                 }
//             });
//         });
//     }
// };


exports.deleteBlob = async (id) => {
    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerName = process.env.BLOB_CONTAINER;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const iter = containerClient.listBlobsFlat();
    let blobItem = await iter.next();
    while (!blobItem.done) {
        if (blobItem.value.name.includes('Voucher_' + id)) {
            
            containerClient.deleteBlob(blobItem.value.name);
        }
        blobItem = await iter.next();
    }
};

// exports.getBlobList = async (id) => {
//     return new Promise((resolve, reject) => {
//         blobService.listBlobsSegmentedWithPrefix(process.env.BLOB_CONTAINER, 'Voucher_' + id, null, (err, result) => {
//             if (err) {
//                 console.log('blobs not found');
//                 reject(err);
//             } else {
//                 resolve(result.entries);
//             }
//         });
//     });
// };

// exports.deleteBlobList = (blobResult) => {
//     const blobRequestArray = new Array();
//     if (Array.isArray(blobResult)) {
//         blobResult.forEach(element => {
//             const req = new Promise((resolve, reject) => {
//                 blobService.deleteBlobIfExists(process.env.BLOB_CONTAINER, element.name, (error) => {
//                     if (error) {
//                         reject(error);
//                     } else {
//                         resolve(true);
//                     }
//                 });
//             });
//             blobRequestArray.push(req);
//         });

//     }
//     return Promise.all(blobRequestArray);
// };


exports.restoreExistingDocuments = async collectionName => {
    const collection = await getMongodbCollection(collectionName);
    await this.removeTestDocuments(collectionName);

    if (existingVoucherDocuments.length) {
        await collection.insertMany(existingVoucherDocuments);
    }

    if (existingRedemptionDocuments.length) {
        await collection.insertMany(existingRedemptionDocuments);
    }

    if (existingPassesDocuments.length) {
        await collection.insertMany(existingPassesDocuments);
    }
    if (existingBalanceAccountDocuments.length) {
        await collection.insertMany(existingBalanceAccountDocuments);
    }
};

exports.createTestDocuments = async (collectionName, document) => {
    const collection = await getMongodbCollection(collectionName);
    await collection.insertOne(document);
};

exports.removeTestDocuments = async collectionName => {
    const collection = await getMongodbCollection(collectionName);
    await Promise.all([
        collection.deleteMany({ docType: 'vouchers' }),
        collection.deleteMany({ docType: 'redemption' }),
        collection.deleteMany({ docType: 'passes' }),
        collection.deleteMany({ docType: 'balanceAccount' })
    ]);
};

exports.stringifyAndParse = data => JSON.parse(JSON.stringify(data));

exports.getRedemptionDocument = async (collectionName, voucherId) => {
    const collection = await getMongodbCollection(collectionName);
    const document = await collection.findOne({
        docType: 'redemption',
        voucherID: voucherId
    });

    return this.stringifyAndParse(document);
};

exports.getRandomBytes = (length, encoding) => crypto
    .randomBytes(length)
    .toString(encoding)
    .toUpperCase();
