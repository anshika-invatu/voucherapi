'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const Promise = require('bluebird');
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(),passToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucher.partitionKey = sampleVoucher.passToken;

describe('Create voucher', () => {

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to create a new voucher but the request body seems to be empty. Kindly pass the voucher to be created using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    _id: 123
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The _id field specified in the request body does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if the document already exists', async () => {

        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: sampleVoucher,
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 409,
                description: 'You\'ve requested to create a new vouchers but a vouchers with the specified _id field already exists.',
                reasonPhrase: 'DuplicateVoucherError'
            };

            expect(error.statusCode).to.equal(409);
            expect(error.error).to.eql(response);
        }
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });

    it('should create document when all validation passes', async () => {

        const voucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
            body: sampleVoucher,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucher).not.to.be.null;
        expect(voucher._id).to.equal(sampleVoucher._id);
        expect(voucher.docType).to.equal('vouchers');

        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });

    it('should create document with lowercase passToken when all validation passes', async () => {

        const sampleVoucherClone = Object.assign({}, sampleVoucher, { passToken: sampleVoucher.passToken.toUpperCase() });
        sampleVoucherClone.partitionKey = sampleVoucherClone.passToken;
        const voucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
            body: sampleVoucherClone,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucher).not.to.be.null;
        expect(voucher._id).to.equal(sampleVoucherClone._id);
        expect(voucher.docType).to.equal('vouchers');
        expect(voucher.event).to.equal('created');

        expect(sampleVoucherClone.passToken).to.not.equal(voucher.passToken);
        expect(sampleVoucherClone.passToken.toLowerCase()).to.equal(voucher.passToken);

        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
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