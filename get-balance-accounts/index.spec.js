'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantID = uuid.v4();
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(),issuerMerchantID: sampleMerchantID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Balance Account', () => {
    before(async () => {
        sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleBalanceAccount);
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/balance-accounts/${123}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The id field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if balanceAccount not exist of specified details', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/balance-accounts/${uuid.v4()}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The balance account of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'BalanceAccountNotFoundError'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return document when all validation passes', async () => {
        const balanceAccount = await request.get(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(balanceAccount).not.to.be.null;
        expect(balanceAccount._id).to.be.equal(sampleBalanceAccount._id);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleBalanceAccount._id });
    });
});