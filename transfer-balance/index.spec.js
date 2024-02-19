'use strict';

const uuid = require('uuid');
const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const { getMongodbCollection } = require('../db/mongodb');
const sampleFromBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(), balanceCurrency: 'SEK' };
const sampleToBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: uuid.v4(), balanceCurrency: 'SEK' };
const sampleBalanceAccountTransactions = { ...require('../spec/sample-docs/BalanceAccountTransactions'), _id: uuid.v4() };
sampleBalanceAccountTransactions.fromBalanceAccountID = sampleFromBalanceAccount._id;
sampleBalanceAccountTransactions.partitionKey = sampleBalanceAccountTransactions._id;
sampleBalanceAccountTransactions.transactionStatus = 'pending';
sampleBalanceAccountTransactions.transferCurrency = 'SEK';
sampleBalanceAccountTransactions.toBalanceAccountID = sampleToBalanceAccount._id;
sampleBalanceAccountTransactions.transferAmount = 500;
sampleFromBalanceAccount.partitionKey = sampleFromBalanceAccount._id;
sampleToBalanceAccount.partitionKey = sampleToBalanceAccount._id;

describe('transfer-balance', () => {

    before(async () => {

        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleFromBalanceAccount);
        await collection.insertOne(sampleToBalanceAccount);
    });
    
    it('Update balanceAccount if transaction successful', async () => {
        const result = await request.post(`${helpers.API_URL}/api/v1/transfer-balance`, {
            body: sampleBalanceAccountTransactions,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).to.eql({
            code: 200,
            description: 'Successfully transfer the balance'
        });

        const collection2 = await getMongodbCollection('Vouchers');
        const balanceaccount1 = await collection2.findOne({ _id: sampleFromBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleFromBalanceAccount._id });
        expect(balanceaccount1).not.to.be.null;
        expect(balanceaccount1.balanceAmount).to.be.equal(sampleFromBalanceAccount.balanceAmount - sampleBalanceAccountTransactions.transferAmount);
        const balanceaccount2 = await collection2.findOne({ _id: sampleToBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleToBalanceAccount._id });
        expect(balanceaccount2).not.to.be.null;
        expect(balanceaccount2.balanceAmount).to.be.equal(sampleToBalanceAccount.balanceAmount + sampleBalanceAccountTransactions.transferAmount);


    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleFromBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleFromBalanceAccount._id });
        await collection.deleteOne({ _id: sampleToBalanceAccount._id, docType: 'balanceAccount', partitionKey: sampleToBalanceAccount._id });
        await collection.deleteOne({ _id: sampleBalanceAccountTransactions._id, docType: 'balanceAccountTransactions', partitionKey: sampleBalanceAccountTransactions._id });

    });


});
