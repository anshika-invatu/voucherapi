'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantID = uuid.v4();
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(), issuerMerchantID: sampleMerchantID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Balance Account by merchantId', () => {
    before(async () => {
        sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;
        sampleBalanceAccount.ownerID = sampleMerchantID;
        sampleBalanceAccount.ownerType = 'merchant';
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleBalanceAccount);
    });

    it('should return error when merchantID is invalid', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/merchants/${123}/balance-accounts`, {
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

    it('should return empty array if balanceAccount not exist of specified merchantID', async () => {

        const result = await request.get(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/balance-accounts`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(0);

    });

    it('should return document when all validation passes', async () => {
        const balanceAccount = await request.get(helpers.API_URL + `/api/v1/merchants/${sampleMerchantID}/balance-accounts`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(balanceAccount).not.to.be.null;
        expect(balanceAccount[0]._id).to.be.equal(sampleBalanceAccount._id);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleBalanceAccount._id });
    });
});