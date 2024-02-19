'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const sampleMerchantPartnerNetwork = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
}];
sampleMerchantPartnerNetwork.merchantID = samplePartnerNetwork.ownerMerchantID;
sampleMerchantPartnerNetwork.partitionKey = samplePartnerNetwork.ownerMerchantID;
sampleMerchantPartnerNetwork.partnerNetworkMemberships = [{
    partnerNetworkID: samplePartnerNetwork._id,
    partnerNetworkName: 'Turistbutiken i Åre',
    roles: 'admin'
}];

describe('Delete Partner Network', () => {
    before(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.delete(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/partner-networks/${123}`, {
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

    it('should throw error if partnerNetworks not exist of specified details', async () => {
        try {
            await request.delete(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/partner-networks/${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The partnerNetwork of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'PartnerNetworkNotFoundError'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return document when all validation passes', async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMerchantPartnerNetwork);
        const result = await request.delete(helpers.API_URL + `/api/v1/merchants/${merchantID}/partner-networks/${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result.description).to.be.equal('Successfully deleted the partnerNetwork of specified details');
        await collection.deleteOne({ _id: sampleMerchantPartnerNetwork._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork.partitionKey });
    });

});