'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const Promise = require('bluebird');
const utils = require('../utils');
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(uuid.v4()) };
const { getMongodbCollection } = require('../db/mongodb');

describe('Update voucher', () => {

    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to update a voucher but the request body seems to be empty. Kindly specify the voucher properties to be updated using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/vouchers/123`, {
                json: true,
                body: {},
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
            await request.patch(`${helpers.API_URL}/api/v1/vouchers/${uuid.v4()}`, {
                body: { isRedeemed: true },
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

    it('should update document when all validation passes', async () => {
        const result = await request.patch(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
            body: { isRedeemed: true },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(result).to.eql({ description: 'Successfully updated the document' });

        // Get sample document
        const voucher = await request.get(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucher).not.to.be.null;
        expect(voucher.isRedeemed).to.equal(true);
        expect(voucher.event).to.equal('updated');
        expect(voucher.createdDate).not.to.be.null;
        expect(voucher.updatedDate).not.to.be.null;
        expect(voucher.updatedDate).not.to.equal(sampleVoucher.updatedDate);
    });

    it('should update document when all validation passes', async () => {
        const result = await request.patch(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
            body: { isRedeemed: true, event: 'locked' },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(result).to.eql({ description: 'Successfully updated the document' });

        // Get sample document
        const voucher = await request.get(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        
        expect(voucher).not.to.be.null;
        expect(voucher.isRedeemed).to.equal(true);
        expect(voucher.event).to.equal('locked');
        expect(voucher.createdDate).not.to.be.null;
        expect(voucher.updatedDate).not.to.be.null;
        expect(voucher.updatedDate).not.to.equal(sampleVoucher.updatedDate);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        
        await Promise.delay(50000);
        const result = await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        if (result.deletedCount === 0) {
            throw 'voucherLog not deleted';
        }
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