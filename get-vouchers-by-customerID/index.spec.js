'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const passToken = uuid.v4();
const customerID = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const sampleVoucher2 = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers by customerID', () => {

    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        sampleVoucher2.partitionKey = sampleVoucher2.passToken;
        sampleVoucher.customerID = customerID;
        sampleVoucher2.customerID = customerID;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        await collection.insertOne(sampleVoucher2);
    });

    it('should throw error when id is not in uuid', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/customers/123/vouchers`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The customerID specified in the request does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return empty array when no vouchers are matched', async () => {
        const url = `${helpers.API_URL}/api/v1/customers/${uuid.v4()}/vouchers`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(0);
    });

    it('should return vouchers matching the passToken', async () => {
        const url = `${helpers.API_URL}/api/v1/customers/${sampleVoucher.customerID}/vouchers`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(2);
        expect(vouchers).to.have.lengthOf(2);
    });
    
    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: sampleVoucher2._id, docType: 'vouchers', partitionKey: sampleVoucher2.passToken });
    });
});