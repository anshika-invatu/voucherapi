'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const passToken = uuid.v4();
const walletID = uuid.v4();
const Promise = require('bluebird');
//const helpers = require('../spec/helpers');
const { BlobServiceClient } = require('@azure/storage-blob');
const expect = require('chai').expect;
const crypto = require('crypto');
const request = require('request-promise');
const randomString = crypto.randomBytes(3).toString('hex');
const email = `test.${randomString}@vourity.com`;
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
const sampleWallets = { ...require('../spec/sample-docs/Wallets'), _id: walletID, email: email, mobilePhone: '+4670123456789456' };
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucher.partitionKey = sampleVoucher.passToken;
sampleWallets.mobilePhone = Math.floor(Math.random() * 1000000000);
sampleWallets.vourityID = `ABC${randomString}`;

describe('subscribers-for-send-notifications', () => {

    it('should send notifiction message when all case pass', async () => {
        await request.post(process.env.WALLET_API_URL + '/api/' + process.env.WALLET_API_VERSION + '/wallets', {
            body: sampleWallets,
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
        sampleVoucher.docType = 'vouchers';
        sampleVoucher.event = 'redemption';
        sampleVoucher.notificationSubscribers = [
            {
                walletID: walletID,
                events: 'redemption'
            }];
        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher);
        } catch (err) {
            console.log(err);
        }

        await request.delete(`${process.env.WALLET_API_URL}/api/${process.env.WALLET_API_VERSION}/wallets/${sampleWallets._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });

        await Promise.delay(50000);
        const message = '';
        try {
            //message = await helpers.getMessageFromAzureBus(process.env.AZURE_BUS_TOPIC_NOTIFICATION_EMAIL, 'test');
        } catch (err) {
            console.log(err);
        }
        expect(message).not.to.be.null;
        const collection = await getMongodbCollection('Vouchers');
        const deletedlog = await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        console.log(deletedlog.deletedCount);
        await deleteBlob();
    });

});

async function deleteBlob () {
    
    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerName = process.env.BLOB_CONTAINER;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const iter = containerClient.listBlobsFlat();
    let blobItem = await iter.next();
    while (!blobItem.done) {
        if (blobItem.value.name.includes('Voucher_' + sampleVoucher._id)) {
            
            containerClient.deleteBlob(blobItem.value.name);
        }
        blobItem = await iter.next();
    }
}
