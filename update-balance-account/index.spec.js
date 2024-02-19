'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantID = uuid.v4();
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(), issuerMerchantID: sampleMerchantID };
const { getMongodbCollection } = require('../db/mongodb');

describe('Update Balance Account', () => {
    before(async () => {
        sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleBalanceAccount);
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/balance-accounts/${123}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to update a balanceAccount but the request body seems to be empty. Kindly pass the balanceAccount fields to be updated using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/balance-accounts/${123}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
                body: {
                    balanceAccountDescription: 'Nice account Updated'
                },
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
            await request.patch(helpers.API_URL + `/api/v1/balance-accounts/${uuid.v4()}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
                body: {
                    balanceAccountDescription: 'Nice account Updated'
                },
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

    it('should update document when all validation passes', async () => {
        const result = await request.patch(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            body: {
                countryCode: 'IN',
                balanceAmount: 500,
                balanceAccountType: 'voucher',
                creditLimit: 200,
                creditInterestRate: 123,
                balanceCurrency: 'INR'
            },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully updated the document'
        });
        const balanceAccount = await request.get(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(balanceAccount).not.to.be.null;
        expect(balanceAccount._id).to.be.equal(sampleBalanceAccount._id);
        expect(balanceAccount.balanceAmount).not.to.be.equal(500);
        expect(balanceAccount.creditLimit).not.to.be.equal(200);
        expect(balanceAccount.creditInterestRate).not.to.be.equal(123);
        expect(balanceAccount.balanceCurrency).not.to.be.equal('INR');
        expect(balanceAccount.countryCode).to.be.equal('IN');
    });

    it('should update document when all validation passes', async () => {
        const result = await request.patch(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            body: {
                balanceAccountDescription: 'Nice account Updated'
            },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully updated the document'
        });
        const balanceAccount = await request.get(helpers.API_URL + `/api/v1/balance-accounts/${sampleBalanceAccount._id}?merchantID=${sampleBalanceAccount.issuerMerchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(balanceAccount).not.to.be.null;
        expect(balanceAccount._id).to.be.equal(sampleBalanceAccount._id);
        expect(balanceAccount.balanceAccountDescription).to.be.equal('Nice account Updated');
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleBalanceAccount._id });
    });
});