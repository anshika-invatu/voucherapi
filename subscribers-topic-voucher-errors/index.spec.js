'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const passToken = uuid.v4();
const merchantID = uuid.v4();
const Promise = require('bluebird');
const request = require('request-promise');
const helpers = require('../spec/helpers');
const { BlobServiceClient } = require('@azure/storage-blob');
const expect = require('chai').expect;
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucher.partitionKey = sampleVoucher.passToken;
sampleMerchant.partitionKey = sampleMerchant._id;

describe('subscribers-topic-voucher-errors', () => {
    const error = {
        message: 'error for testing',
        name: 'testing',
        err: 404
    };
    it('should not save doc in database when docType is not voucherLog', async () => {

        try {
            const voucherLog = await utils.voucherLog(sampleVoucher, sampleMerchant, error);
            voucherLog.docType = 'vouchers';
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_ERRORS, voucherLog);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(21000);
        const collection = await getMongodbCollection('Vouchers');
        const voucherLog = await collection.findOne({ docType: 'voucherLog', partitionKey: sampleVoucher._id });
        expect(voucherLog).to.be.null;

    });

    it('should save doc in database when docType is voucherLog', async () => {
        await request.post(helpers.API_URL + '/api/v1/vouchers', {
            body: sampleVoucher,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        try {
            const voucherLog = await utils.voucherLog(sampleVoucher, sampleMerchant, error);
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_ERRORS, voucherLog);
        } catch (err) {
            console.log(err);
        }
        
        await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
       
        await Promise.delay(50000);

        const collection = await getMongodbCollection('Vouchers');
        const voucherLog = await collection.findOne({ docType: 'voucherLog', partitionKey: sampleVoucher._id });
        expect(voucherLog).not.to.be.null;
        expect(voucherLog.voucherID).to.equal(sampleVoucher._id);
        const result = await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        if (result.deletedCount === 0) {
            throw 'voucherLog not deleted';
        }
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