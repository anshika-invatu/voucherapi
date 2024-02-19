'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;

describe('Create Balance Account', () => {

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/balance-accounts', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to create a new balanceAccount but the request body seems to be empty. Kindly pass the balanceAccount to be created using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/balance-accounts', {
                body: {
                    _id: 123
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The _id field specified in the request body does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should create document when all validation passes', async () => {
       

        const balanceAccount = await request.post(helpers.API_URL + '/api/v1/balance-accounts', {
            body: sampleBalanceAccount,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(balanceAccount).not.to.be.null;
        expect(balanceAccount._id).to.equal(sampleBalanceAccount._id);
        expect(balanceAccount.docType).to.equal('balanceAccount');
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleBalanceAccount._id });
    });
});