'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const pass = uuid.v4();
const utils = require('../utils');
const passToken = utils.hashToken(pass);
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const sampleVoucher2 = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers Withfilters', () => {

    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        sampleVoucher2.partitionKey = sampleVoucher2.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        await collection.insertOne(sampleVoucher2);
    });

    it('should throw error when request body is null', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/vouchers-withfilters`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to get vouchers but the request body seems to be empty. Kindly pass the atleast one parameter using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error when request body is empty object', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/vouchers-withfilters`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {}
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to get vouchers but the request body seems to be empty. Kindly pass the atleast one parameter using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return doc when pass anyone input field in req body', async () => {
        const vouchers = await request.post(`${helpers.API_URL}/api/v1/vouchers-withfilters`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                passToken: pass,
                merchantIDs: [sampleVoucher.issuer.merchantID]
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(2);
        expect(vouchers[0].docType).to.equal('vouchers');

    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: sampleVoucher2._id, docType: 'vouchers', partitionKey: sampleVoucher2.passToken });
    });
});