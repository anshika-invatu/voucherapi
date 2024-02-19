'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantId = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers by MerchantId', () => {
    before(async () => {
        sampleVoucher.collectorLimitationsMerchants = new Array({ merchantID: sampleMerchantId });
        sampleVoucher.collectorLimitationsMerchants.push({ merchantID: uuid.v4() });
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
    });

    it('should throw error if query string parameter not provided', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/view-pass`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'Please provide passToken or voucherToken.',
                reasonPhrase: 'FieldValidationError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });
  
    it('should return vouchers linked to voucherToken provided', async () => {
        const url = `${helpers.API_URL}/api/v1/view-pass?voucherToken=${sampleVoucher.voucherToken}`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.not.have.lengthOf(0);
      
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });
});