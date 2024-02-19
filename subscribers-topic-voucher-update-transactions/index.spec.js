'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const passToken = uuid.v4();
const Promise = require('bluebird');
const helpers = require('../spec/helpers');
const expect = require('chai').expect;

const sampleVoucher = createSampleVoucher();
const sampleVoucher2 = createSampleVoucher();
const sampleVoucher3 = createSampleVoucher();

const sampleMultiFunctionRedemptionVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
sampleMultiFunctionRedemptionVoucher.partitionKey = sampleMultiFunctionRedemptionVoucher.passToken;
sampleMultiFunctionRedemptionVoucher.settlementList.settlementTransactions = createSampleRedemptionTransactions(true);

const sampleSinglePurposeRedemptionVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
sampleSinglePurposeRedemptionVoucher.partitionKey = sampleSinglePurposeRedemptionVoucher.passToken;
sampleSinglePurposeRedemptionVoucher.settlementList.settlementTransactions = createSampleRedemptionTransactions(false);

const { getMongodbCollection } = require('../db/mongodb');

function createSampleVoucher () {
    const ret = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), voucherToken: uuid.v4() };
    ret.partitionKey = ret.passToken;
    ret.settlementList.settlementTransactions = createSampleSettlementTransactions();
    return ret;
}

function createSampleSettlementTransactions () {
    return [
        {
            _id: uuid.v4(),
            settlementTransactionID: '474b917c-9971-4ec4-89b5-0ab80f2607ae',
            merchantID: '474b917c-9971-4ec4-89b5-0ab80f2607ae',
            merchantName: 'Parks and Resorts',
            merchantType: 'collector',
            settlementStatus: 'pending',
            settlementAmount: 123456.00,
            productClass: 'salesSPV',
            productClassName: 'Sales Single Purpose Voucher',
            vatPercent: 25.00,
            vatAmount: 100.56,
            currency: 'SEK',
            vatClass: 'VAT1',
            isMultiFunctionVoucher: false,
            trigger: 'expiredVoucher',
            fromBalanceAccountID: '12358cfa-063d-4f5c-be5d-b90cfb64d1d6',
            toBalanceAccountID: '22358cfa-063d-4f5c-be5d-b90cfb64d1d6'
        }];
}

function createSampleRedemptionTransactions (isMultiFunctionVoucher) {
    return [
        {
            _id: uuid.v4(),
            settlementTransactionID: '474b917c-9971-4ec4-89b5-0ab80f2607ae',
            merchantID: '474b917c-9971-4ec4-89b5-0ab80f2607ae',
            merchantName: 'Parks and Resorts',
            merchantType: 'collector',
            settlementStatus: 'pending',
            settlementAmount: 123456.00,
            productClass: 'salesSPV',
            productClassName: 'Sales Single Purpose Voucher',
            vatPercent: 25.00,
            vatAmount: 100.56,
            currency: 'SEK',
            vatClass: 'VAT1',
            isMultiFunctionVoucher: isMultiFunctionVoucher,
            trigger: 'redemption',
            fromBalanceAccountID: '12358cfa-063d-4f5c-be5d-b90cfb64d1d6',
            toBalanceAccountID: '22358cfa-063d-4f5c-be5d-b90cfb64d1d6'
        }];
}

describe('subscribers-topic-voucher-update-transactions', () => {

    it('should create two clearing transactions (withdarawal, sales) for multi-purpose redemption settlement transaction', async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMultiFunctionRedemptionVoucher);
        await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleMultiFunctionRedemptionVoucher);
        await Promise.delay(10000);
    });

    it('should create three clearing transactions (purchase, serviceFee, sales) for single-purpose redemption settlement transaction', async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleSinglePurposeRedemptionVoucher);
        await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleSinglePurposeRedemptionVoucher);
        await Promise.delay(10000);
    });

    it('should not update doc in database when docType is not vouchers', async () => {
        const collection = await getMongodbCollection('Vouchers');
        sampleVoucher.docType = 'voucherLog';
        await collection.insertOne(sampleVoucher);
        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(10000);
        const updatedVoucher = await collection.findOne({ _id: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher.passToken });
        expect(updatedVoucher).not.to.be.null;
        expect(updatedVoucher.settlementList.settlementTransactions).to.be.instanceOf(Array).and.have.lengthOf(1);

    });

    /*  it('should update doc in database when docType is vouchers', async () => {
        const collection = await getMongodbCollection('Vouchers');
        sampleVoucher3.docType = 'vouchers';
        sampleVoucher3.event = 'redemption';
        await collection.insertOne(sampleVoucher3);
        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher3);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(50000);
        const updatedVoucher = await collection.findOne({ _id: sampleVoucher3._id, docType: 'vouchers', partitionKey: sampleVoucher3.passToken });
        expect(updatedVoucher).not.to.be.null;
        expect(updatedVoucher.settlementList.settlementTransactions).to.be.instanceOf(Array).and.have.lengthOf(0);
    }); */


    it('should not update doc in database when event is updated', async () => {
        const collection = await getMongodbCollection('Vouchers');
        sampleVoucher.docType = 'vouchers';
        sampleVoucher.event = 'updated';
        await collection.insertOne(sampleVoucher);
        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(5000);
        const updatedVoucher = await collection.findOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        expect(updatedVoucher).not.to.be.null;
        expect(updatedVoucher.settlementList.settlementTransactions).to.be.instanceOf(Array).and.have.lengthOf(1);
    });

    it('should not update doc in database when settlementList section is empty', async () => {
        sampleVoucher2.docType = 'vouchers';
        sampleVoucher2.event = 'redemption';
        delete sampleVoucher2.settlementList;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher2);
        try {
            await utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, sampleVoucher2);
        } catch (err) {
            console.log(err);
        }
        await Promise.delay(5000);
        const updatedVoucher = await collection.findOne({ _id: sampleVoucher2._id, docType: 'vouchers', partitionKey: sampleVoucher2.passToken });
        expect(updatedVoucher).not.to.be.null;
        expect(updatedVoucher.settlementList).to.eql(undefined);
    });

    afterEach(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        const blobList = await helpers.deleteBlob(sampleVoucher._id);
        console.log(blobList);
        await collection.deleteOne({ _id: sampleMultiFunctionRedemptionVoucher._id, partitionKey: sampleMultiFunctionRedemptionVoucher.passToken });
        await collection.deleteOne({ _id: sampleSinglePurposeRedemptionVoucher._id, partitionKey: sampleSinglePurposeRedemptionVoucher.passToken });
        await collection.deleteOne({ _id: sampleVoucher._id, partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: sampleVoucher2._id, partitionKey: sampleVoucher2.passToken });
        await collection.deleteOne({ _id: sampleVoucher3._id, partitionKey: sampleVoucher3.passToken });

    });

});
