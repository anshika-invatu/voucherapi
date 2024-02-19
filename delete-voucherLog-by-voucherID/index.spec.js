'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucherID = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: sampleVoucherID };
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucherLog = { ...require('../spec/sample-docs/VoucherLog'), _id: uuid.v4(), voucherID: sampleVoucherID };
const sampleRedemption = { ...require('../spec/sample-docs/Redemption'), _id: uuid.v4(), voucherID: sampleVoucherID };
const sampleVoucherLog2 = { ...require('../spec/sample-docs/VoucherLog'), _id: uuid.v4(), voucherID: sampleVoucherID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Delete VoucherLog by voucherID', () => {
   
    it('should delete document when all validation passes', async () => {
        sampleVoucherLog.partitionKey = sampleVoucherID;
        sampleVoucherLog2.partitionKey = sampleVoucherID;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLog);
        await collection.insertOne(sampleVoucherLog2);
        const voucherLog = await request.delete(helpers.API_URL + `/api/v1/vouchers/${sampleVoucherID}/voucherLog`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(voucherLog).not.to.be.null;
        expect(voucherLog).to.be.equal(2);
    });

    it('should delete document when all validation passes', async () => {
        sampleVoucherLog.partitionKey = sampleVoucherID;
        sampleVoucherLog2.partitionKey = sampleVoucherID;
        sampleRedemption.partitionKey = sampleRedemption._id;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLog);
        await collection.insertOne(sampleVoucherLog2);
        await collection.insertOne(sampleRedemption);
        await createBlob();
        const voucherLog = await request.delete(helpers.API_URL + `/api/v1/vouchers/${sampleVoucherID}/voucherLog`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(voucherLog).not.to.be.null;
        expect(voucherLog).to.be.equal(2);
    });

});

async function createBlob () {
    
    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerName = process.env.BLOB_CONTAINER;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const voucher = JSON.stringify(sampleVoucher);
    const fileName = `Voucher_${sampleVoucherID}_${Math.floor((Date.now()) / 1000)}.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const uploadBlobResponse = await blockBlobClient.upload(voucher, voucher.length);
    console.log(`Upload block blob ${fileName} successfully`, uploadBlobResponse.requestId);
}