'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const Promise = require('bluebird');
const merchantID = uuid.v4();
const { getMongodbCollection, getMongodbCollectionRegional } = require('../db/mongodb');
const expect = require('chai').expect;
const sampleRedemption = { ...require('../spec/sample-docs/Redemption'), _id: uuid.v4(), partitionKey: merchantID };
sampleRedemption.issuer.merchantID = merchantID;


describe('subscribers-for-send-redemption', () => {
    it('should save data if docType is redemption', async () => {
        sampleRedemption.docType = 'redemption';
        await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_REDEMPTIONS, sampleRedemption);
        await Promise.delay(50000);
        const collection = await getMongodbCollection('Vouchers');
        const redemption = await collection.findOne({ _id: sampleRedemption._id, docType: 'redemption', partitionKey: merchantID });
        expect(redemption).not.to.be.null;
        expect(redemption._id).to.equal(sampleRedemption._id);
        const result = await collection.deleteOne({ _id: sampleRedemption._id, docType: 'redemption', partitionKey: merchantID });
        if (result.deletedCount === 0) {
            throw 'voucherLog not deleted';
        }
    });

    it('should not save data if docType is not redemption', async () => {
        sampleRedemption.docType = 'vouchers';
        await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_REDEMPTIONS, sampleRedemption);
        await Promise.delay(50000);
        const collection = await getMongodbCollection('Vouchers');
        const redemption = await collection.findOne({ _id: sampleRedemption._id, docType: 'redemption', partitionKey: merchantID });
        expect(redemption).to.be.null;
    });

    after(async () => {
        const collection = await getMongodbCollectionRegional('Merchants');
        const deleted = await collection.deleteOne({ merchantID: merchantID, docType: 'merchantstatisticsdaily', partitionKey: merchantID });
        console.log(deleted.deletedCount);
        const deleted2 = await collection.deleteOne({ merchantID: merchantID, docType: 'merchantstatisticsmonthly', partitionKey: merchantID });
        console.log(deleted2.deletedCount);
    });

});
