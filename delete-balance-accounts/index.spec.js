'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantID = uuid.v4();
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(),issuerMerchantID: sampleMerchantID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Delete Balance Account', () => {
    
    before(async () => {
        sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleBalanceAccount);
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.delete(helpers.API_URL + `/api/v1/balance-accounts/${123}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
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
            await request.delete(helpers.API_URL + `/api/v1/balance-accounts/${uuid.v4()}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
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

    it('should delete document when all validation passes', async () => {
        const result = await request.delete(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully deleted the balanceAccount of specified details'
        });
    });
});