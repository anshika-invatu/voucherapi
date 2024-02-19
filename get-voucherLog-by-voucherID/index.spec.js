'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucherID = uuid.v4();
const sampleVoucherLog = { ...require('../spec/sample-docs/VoucherLog'), _id: uuid.v4(), voucherID: sampleVoucherID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get VoucherLog by voucherID', () => {
    before(async () => {
        sampleVoucherLog.partitionKey = sampleVoucherID;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLog);
    });

    it('should return error when voucherID is invalid', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/vouchers/${123}/voucherLog`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The voucherID field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return empty array if voucherLog not exist of specified voucherID', async () => {

        const result = await request.get(helpers.API_URL + `/api/v1/vouchers/${uuid.v4()}/voucherLog`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(result).to.be.instanceOf(Array).and.have.lengthOf(0);

    });

    it('should return document when all validation passes', async () => {
        const voucherLog = await request.get(helpers.API_URL + `/api/v1/vouchers/${sampleVoucherID}/voucherLog`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucherLog).not.to.be.null;
        expect(voucherLog[0]._id).to.be.equal(sampleVoucherLog._id);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucherLog._id, docType: 'voucherLog', partitionKey: sampleVoucherID });
    });
});