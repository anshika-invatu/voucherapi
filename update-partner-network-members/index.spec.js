'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const merchantID1 = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
const sampleMerchantPartnerNetwork = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.ownerMerchantID = merchantID;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
},
{
    merchantID: merchantID1,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
}];
sampleMerchantPartnerNetwork.merchantID = merchantID1;
sampleMerchantPartnerNetwork.partitionKey = merchantID1;
sampleMerchantPartnerNetwork.partnerNetworkMemberships = [{
    partnerNetworkID: samplePartnerNetwork._id,
    partnerNetworkName: 'Turistbutiken i Åre',
    roles: 'admin'
}];

describe('Update Partner Network Members', () => {
    before(async () => {
        samplePartnerNetwork.partnerNetworkMembers[0].roles = 'admin';
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/partner-networks/${123}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to update a partnerNetworkMember but the request body seems to be empty. Kindly pass the request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/partner-networks/${123}`, {
                body: {},
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

    it('should throw error if partnerNetwork not exist of specified details', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/partner-networks/${uuid.v4()}`, {
                body: {},
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

    it('should update document when all validation passes', async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMerchantPartnerNetwork);
        const url = helpers.API_URL + `/api/v1/partner-networks/${samplePartnerNetwork._id}`;
        const result = await request.patch(url, {
            body: {
                requestedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: samplePartnerNetwork.partnerNetworkMembers[1].merchantID,
                commissionAmount: 15.5,
                roles: 'member'
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
        const merchantPartnerNetwork = await collection.findOne({ _id: sampleMerchantPartnerNetwork._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetwork.partitionKey });
        expect(merchantPartnerNetwork).not.to.be.null;
        expect(merchantPartnerNetwork.merchantID).to.eql(merchantID1);
        expect(merchantPartnerNetwork.partnerNetworkMemberships[0].roles).to.eql('member');
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});