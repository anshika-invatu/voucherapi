'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const Promise = require('bluebird');
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Delete Voucher', () => {
    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
    });

    it('should throw error on incorrect id field', async () => {
        try {
            await request.delete(`${helpers.API_URL}/api/v1/vouchers/123-abc`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The voucher id specified in the URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw 404 error if the documentId is invalid', async () => {
        try {
            await request.delete(`${helpers.API_URL}/api/v1/vouchers/${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The voucher id specified in the URL doesn\'t exist.',
                reasonPhrase: 'VoucherNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should delete the document when all validation passes', async () => {
        const voucher = await request
            .delete(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

        expect(voucher).not.to.be.null;
        expect(voucher).to.eql({ description: 'Successfully deleted the specified voucher' });

        // Get document
        try {
            await request.get(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            expect(error.statusCode).to.equal(404);
        }
    });

    after(async () => {
        await Promise.delay(50000);
        const collection = await getMongodbCollection('Vouchers');
        const result = await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        console.log(result.deletedCount);
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