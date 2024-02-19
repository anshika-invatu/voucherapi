'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4() };
const senderPass = { ...require('../spec/sample-docs/Passes'), _id: uuid.v4() };
const receiverPass = { ...require('../spec/sample-docs/Passes'), _id: uuid.v4() };
const crypto = require('crypto');
const randomString = crypto.randomBytes(3).toString('hex');
const email = `test.${randomString}@vourity.com`;
const sampleWallet = { ...require('../spec/sample-docs/Wallets'), _id: uuid.v4(),eamil: email };
const utils = require('../utils');
const { getMongodbCollection } = require('../db/mongodb');
sampleWallet.mobilePhone = Math.floor(Math.random() * 1000000000);
sampleWallet.vourityID = `ABC${randomString}`;

describe('Move Voucher', () => {

    before(async () => {
        senderPass.walletID = sampleWallet._id;
        receiverPass.walletID = sampleWallet._id;
        senderPass.passToken = uuid.v4();
        receiverPass.passToken = uuid.v4();
        senderPass.partitionKey = senderPass._id;
        receiverPass.partitionKey = receiverPass._id;
        var collection = await getMongodbCollection('Passes');
        await collection.insertOne(senderPass);
        await collection.insertOne(receiverPass);
        sampleVoucher.passToken = utils.hashToken(senderPass.passToken);
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        await request.post(process.env.WALLET_API_URL + '/api/v1/wallets', {
            body: sampleWallet,
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
    });

    it('should throw error if from pass id specified does not exists', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/move`, {
                json: true,
                body: {
                    fromPassID: uuid.v4(),
                    toPassID: uuid.v4(),
                    voucherID: uuid.v4()
                },
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The fromPassID specified in the body doesn\'t exist.',
                reasonPhrase: 'PassNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if to pass id specified does not exists', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/move`, {
                json: true,
                body: {
                    fromPassID: senderPass._id,
                    toPassID: uuid.v4(),
                    voucherID: uuid.v4()
                },
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The toPassID specified in the body doesn\'t exist.',
                reasonPhrase: 'PassNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });


    it('should transfer voucher successfully if all validation passes', async () => {

        const result = await request.post(`${helpers.API_URL}/api/v1/move`, {
            json: true,
            body: {
                fromPassID: senderPass._id,
                toPassID: receiverPass._id,
                voucherID: sampleVoucher._id
            },
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({ code: 200, description: 'Voucher moved successfully.' });
    });


    after(async () => {
        await request.delete(`${process.env.WALLET_API_URL}/api/v1/wallets/${sampleWallet._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
        var collection = await getMongodbCollection('Passes');
        await collection.deleteOne({ _id: senderPass._id, docType: 'passes', partitionKey: senderPass._id });
        await collection.deleteOne({ _id: receiverPass._id, docType: 'passes', partitionKey: receiverPass._id });
        collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ docType: 'vouchers', partitionKey: utils.hashToken(receiverPass.passToken) });
    });
    
});