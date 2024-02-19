'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleOrderId = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers by orderID', () => {

    before(async () => {
        sampleVoucher.orderID = sampleOrderId;
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
    });

    it('should throw error on incorrect order id field', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/order/123-abc/vouchers`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The order id specified in the URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });


    it('should return vouchers linked to order id provided', async () => {
        const url = `${helpers.API_URL}/api/v1/order/${sampleOrderId}/vouchers`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).not.to.be.null;
        expect(vouchers).to.be.instanceOf(Array).and.not.have.lengthOf(0);

    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });
});