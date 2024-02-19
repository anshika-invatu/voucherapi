'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const Promise = require('bluebird');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID1 = uuid.v4();
const merchantID2 = uuid.v4();
const merchantID3 = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const sampleMerchantPartnerNetwork = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
const sampleMerchantPartnerNetwork1 = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
const sampleMerchantPartnerNetwork2 = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID1,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
},
{
    merchantID: merchantID3,
    merchantName: 'Turistbutiken i Åre3',
    commissionAmount: 20.50,
    commissionPercent: 10.00,
    currency: 'SEK',
    roles: 'member'
}];
samplePartnerNetwork.partnerNetworkInvites = [{
    merchantID: merchantID2,
    merchantName: 'Turistbutiken i Åre2',
    commissionAmount: 19.50,
    commissionPercent: 7.00,
    currency: 'SEK',
    roles: 'member'
}];
sampleMerchantPartnerNetwork1.merchantID = merchantID3;
sampleMerchantPartnerNetwork1.partitionKey = merchantID3;
sampleMerchantPartnerNetwork1.partnerNetworkMemberships = [{
    partnerNetworkID: samplePartnerNetwork._id,
    partnerNetworkName: 'Turistbutiken i Åre',
    roles: 'admin'
}];
sampleMerchantPartnerNetwork2.merchantID = merchantID2;
sampleMerchantPartnerNetwork2.partitionKey = merchantID2;
sampleMerchantPartnerNetwork2.partnerNetworkInvites = [{
    partnerNetworkID: samplePartnerNetwork._id,
    partnerNetworkName: 'Turistbutiken i Åre',
    roles: 'admin'
}];
sampleMerchantPartnerNetwork.merchantID = merchantID1;
sampleMerchantPartnerNetwork.partitionKey = merchantID1;
sampleMerchantPartnerNetwork.partnerNetworkMemberships = [{
    partnerNetworkID: samplePartnerNetwork._id,
    partnerNetworkName: 'Turistbutiken i Åre',
    roles: 'admin'
}];

describe('subscribers-topic-voucher-partner-network-updates', () => {
    before(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
    });

    it('should update document when all validation passes', async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMerchantPartnerNetwork);
        await collection.insertOne(sampleMerchantPartnerNetwork1);
        await collection.insertOne(sampleMerchantPartnerNetwork2);
        const url = helpers.API_URL + `/api/v1/merchants/${merchantID1}/partner-networks/${samplePartnerNetwork._id}`;
        const result = await request.patch(url, {
            body: {
                partnerNetworkName: 'test'
            },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result._id).to.eql(samplePartnerNetwork._id);
        expect(result.partnerNetworkName).to.eql('test');
        await Promise.delay(20000);

        const merchantPartnerNetwork = await collection.findOne({ _id: sampleMerchantPartnerNetwork._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork.partitionKey });
        expect(merchantPartnerNetwork).not.to.be.null;
        expect(merchantPartnerNetwork.merchantID).to.eql(merchantID1);
        expect(merchantPartnerNetwork.partnerNetworkMemberships[0].partnerNetworkName).to.eql('test');
        expect(merchantPartnerNetwork.partnerNetworkMemberships).to.be.instanceOf(Array).and.have.lengthOf(1);
        expect(merchantPartnerNetwork.partnerNetworkInvites).to.be.instanceOf(Array).and.have.lengthOf(2);

        const merchantPartnerNetwork3 = await collection.findOne({ _id: sampleMerchantPartnerNetwork2._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork2.partitionKey });
        expect(merchantPartnerNetwork3).not.to.be.null;
        expect(merchantPartnerNetwork3.merchantID).to.eql(merchantID2);
        //expect(merchantPartnerNetwork3.partnerNetworkInvites[0].partnerNetworkName).to.eql('test');
        expect(merchantPartnerNetwork3.partnerNetworkMemberships).to.be.instanceOf(Array).and.have.lengthOf(2);
        expect(merchantPartnerNetwork3.partnerNetworkInvites).to.be.instanceOf(Array).and.have.lengthOf(1);

        const merchantPartnerNetwork2 = await collection.findOne({ _id: sampleMerchantPartnerNetwork1._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork1.partitionKey });
        expect(merchantPartnerNetwork2).not.to.be.null;
        expect(merchantPartnerNetwork2.merchantID).to.eql(merchantID3);
        expect(merchantPartnerNetwork2.partnerNetworkMemberships[0].partnerNetworkName).to.eql('test');
        expect(merchantPartnerNetwork2.partnerNetworkMemberships).to.be.instanceOf(Array).and.have.lengthOf(1);
        expect(merchantPartnerNetwork2.partnerNetworkInvites).to.be.instanceOf(Array).and.have.lengthOf(2);
        
        await collection.deleteOne({ _id: sampleMerchantPartnerNetwork._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork.partitionKey });
        await collection.deleteOne({ _id: sampleMerchantPartnerNetwork1._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork1.partitionKey });
        await collection.deleteOne({ _id: sampleMerchantPartnerNetwork2._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork2.partitionKey });
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});