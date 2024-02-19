'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const voucherToken = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(),voucherToken,passToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers by voucherToken', () => {
    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
    });

    it('should throw error on incorrect voucherToken id field', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/vouchers/123-abc/voucher`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The voucher token specified in the URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

   
    it('should return vouchers of specified voucherToken', async () => {
        const url = `${helpers.API_URL}/api/v1/vouchers/${voucherToken}/voucher`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(1);
      
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });
});