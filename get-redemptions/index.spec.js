'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const orderID = uuid.v4();
const voucherID = uuid.v4();
const sampleMerchantID = uuid.v4();
const sampleRedemption = { ...require('../spec/sample-docs/Redemption'), _id: uuid.v4() };
const sampleRedemption2 = { ...require('../spec/sample-docs/Redemption'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
sampleRedemption.collectorMerchant = new Array();
sampleRedemption.collectorMerchant.push({
    merchantID: sampleMerchantID,
    merchantName: 'Parks and Resorts'
});
sampleRedemption.collectorMerchant.push({
    merchantID: uuid.v4(),
    merchantName: 'Parks and Resorts'
});
sampleRedemption2.collectorMerchant[0].merchantID = sampleMerchantID;

describe('Get Redemptions', () => {
    before(async () => {
        sampleRedemption.partitionKey = sampleMerchantID;
        sampleRedemption.voucherID = voucherID;
        sampleRedemption.orderID = orderID;
        sampleRedemption.redemptionDate = new Date('2018-10-16T14:05:36Z');
        sampleRedemption2.partitionKey = sampleMerchantID;
        sampleRedemption2.voucherID = voucherID;
        sampleRedemption2.orderID = orderID;
        sampleRedemption2.redemptionDate = new Date('2018-09-16T14:05:36Z');
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleRedemption);
        await collection.insertOne(sampleRedemption2);
    });

    it('should return error when merchantID is invalid', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/merchants/${123}/redemption/${new Date}/${new Date}`;
            await request.get(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The merchantID field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return empty array if redemptions not exist of specified details', async () => {

        const url = helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/redemption/2017-10-16/2018-12-16`;
        const result = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(0);
    });

    it('should return document when all validation passes', async () => {
        const url = helpers.API_URL + `/api/v1/merchants/${sampleMerchantID}/redemption/2017-10-16/2018-12-16`;
        const redemption = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(redemption).not.to.be.null;
        expect(redemption[0]._id).to.be.equal(sampleRedemption._id);
        expect(redemption[1]._id).to.be.equal(sampleRedemption2._id);
    });

    it('should return document when all validation passes (with Optional parameters)', async () => {
        const url = helpers.API_URL + `/api/v1/merchants/${sampleMerchantID}/redemption/2017-10-16/2018-12-16?orderID=${orderID}`;
        const redemption = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(redemption).not.to.be.null;
        expect(redemption[0]._id).to.be.equal(sampleRedemption._id);
        expect(redemption[1]._id).to.be.equal(sampleRedemption2._id);
    });

    it('should return document when all validation passes (with Optional parameters)', async () => {
        const url = helpers.API_URL + `/api/v1/merchants/${sampleMerchantID}/redemption/2017-10-16/2018-12-16?orderID=${orderID}&voucherID=${voucherID}`;
        const redemption = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(redemption).not.to.be.null;
        expect(redemption[0]._id).to.be.equal(sampleRedemption._id);
        expect(redemption[1]._id).to.be.equal(sampleRedemption2._id);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleRedemption._id, docType: 'redemption', partitionKey: sampleMerchantID });
        await collection.deleteOne({ _id: sampleRedemption2._id, docType: 'redemption', partitionKey: sampleMerchantID });

    });
});