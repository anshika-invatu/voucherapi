'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4() };
const sampleVoucher2 = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4() };
const samplePass = { ...require('../spec/sample-docs/Passes'), _id: uuid.v4() };
const crypto = require('crypto');
const randomString = crypto.randomBytes(3).toString('hex');
const randomString1 = crypto.randomBytes(3).toString('hex');
const email = `test.${randomString}@vourity.com`;
const receiverEmail = `test.receiver${randomString}@vourity.com`;
const senderWallet = { ...require('../spec/sample-docs/Wallets'), _id: uuid.v4(), email };
const receiverWallet = { ...require('../spec/sample-docs/Wallets'), _id: uuid.v4() };
const utils = require('../utils');
const { getMongodbCollectionRegional } = require('../db/mongodb');
const { getMongodbCollection } = require('../db/mongodb');
senderWallet.mobilePhone = Math.floor(Math.random() * 1000000000);
receiverWallet.mobilePhone = Math.floor(Math.random() * 1000000000);
senderWallet.vourityID = `ABC${randomString}`;
receiverWallet.vourityID = `ABC${randomString1}`;

describe('Send Voucher', () => {

    before(async () => {
        receiverWallet.email = receiverEmail;
        senderWallet.defaultPassID = samplePass._id;
        receiverWallet.partitionKey = receiverWallet._id;
        senderWallet.partitionKey = senderWallet._id;
        samplePass.walletID = senderWallet._id;
        samplePass.partitionKey = samplePass._id;
        var collection = await getMongodbCollection('Passes');
        await collection.insertOne(samplePass);
        sampleVoucher.passToken = utils.hashToken(samplePass.passToken);
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        sampleVoucher2.passToken = utils.hashToken(samplePass.passToken);
        sampleVoucher2.partitionKey = sampleVoucher2.passToken;
        collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        await collection.insertOne(sampleVoucher2);

        await request.post(process.env.WALLET_API_URL + '/api/v1/wallets', {
            body: senderWallet,
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
        await request.post(process.env.WALLET_API_URL + '/api/v1/wallets', {
            body: receiverWallet,
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
    });

    it('should throw error if sender wallet id is wrong', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/send`, {
                json: true,
                body: {
                    fromWalletID: uuid.v4(),
                    toWalletID: uuid.v4(),
                    voucherID: uuid.v4()
                },
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The fromWalletID specified in the body doesn\'t exist.',
                reasonPhrase: 'WalletNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if receiver wallet id is wrong', async () => {
        try {
            await request.post(`${helpers.API_URL}/api/v1/send`, {
                json: true,
                body: {
                    fromWalletID: senderWallet._id,
                    toWalletID: uuid.v4(),
                    voucherID: uuid.v4()
                },
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The receiver wallet not found with toWalletID or toVourityID specified in the body',
                reasonPhrase: 'WalletNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });


    it('should transfer voucher successfully if all validation passes', async () => {

        const result = await request.post(`${helpers.API_URL}/api/v1/send`, {
            json: true,
            body: {
                fromWalletID: senderWallet._id,
                toWalletID: receiverWallet._id,
                voucherID: sampleVoucher._id,
                message: 'voucher sent'
            },
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        await getMongodbCollectionRegional('Wallets') // Delete walletInbox document
            .then(collection => {
                collection.deleteOne({
                    walletID: receiverWallet._id,
                    docType: 'walletInbox',
                    partitionKey: receiverWallet._id
                });
            });
        expect(result).not.to.be.null;
        expect(result).to.eql({ code: 200, description: 'Voucher sent successfully to receiver wallet' });

    });



    after(async () => {
        await request.delete(`${process.env.WALLET_API_URL}/api/v1/wallets/${senderWallet._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });
        await request.delete(`${process.env.WALLET_API_URL}/api/v1/wallets/${receiverWallet._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.WALLET_API_KEY
            }
        });


        var collection = await getMongodbCollection('Passes');
        const pass = await collection.findOne({ walletID: receiverWallet._id, docType: 'passes' });
        await collection.deleteOne({ _id: samplePass._id, docType: 'passes', partitionKey: samplePass._id });
        await collection.deleteOne({ _id: pass._id, docType: 'passes', partitionKey: pass._id });
        collection = await getMongodbCollection('Vouchers');
        const voucher = await collection.findOne({ passToken: utils.hashToken(pass.passToken), docType: 'vouchers' });
        await collection.deleteOne({ _id: voucher._id, docType: 'vouchers', partitionKey: voucher.partitionKey });
        await collection.deleteOne({ _id: sampleVoucher2._id, docType: 'vouchers', partitionKey: sampleVoucher2.passToken });
    });
});