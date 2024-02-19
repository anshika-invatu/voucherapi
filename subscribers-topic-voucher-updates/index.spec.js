'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const passToken = uuid.v4();
const merchantID = uuid.v4();
const Promise = require('bluebird');
const { BlobServiceClient } = require('@azure/storage-blob');
const expect = require('chai').expect;
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucher.partitionKey = sampleVoucher.passToken;
sampleMerchant.partitionKey = sampleMerchant._id;

describe('subscribers-topic-voucher-updates', () => {

    it('should not save doc in database when docType is not vouchers', async () => {

        try {
            sampleVoucher.docType = 'voucherLog';
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(50000);
        const collection = await getMongodbCollection('Vouchers');
        const voucherLog = await collection.findOne({ docType: 'voucherLog', partitionKey: sampleVoucher._id });
        expect(voucherLog).to.be.null;

    });

    it('should save doc in database when docType is vouchers', async () => {
        sampleVoucher.docType = 'vouchers';
        sampleVoucher.event = 'created';

        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(50000);

        const collection = await getMongodbCollection('Vouchers');
        const voucherLog = await collection.findOne({ docType: 'voucherLog', partitionKey: sampleVoucher._id });
        expect(voucherLog).not.to.be.null;
        expect(voucherLog.voucherID).to.equal(sampleVoucher._id);
        await collection.deleteOne({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
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