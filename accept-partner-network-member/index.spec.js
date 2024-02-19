'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.ownerMerchantID = merchantID;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: samplePartnerNetwork.ownerMerchantID,
    merchantName: samplePartnerNetwork.ownerMerchantName,
    commissionPercent: samplePartnerNetwork.commissionPercent,
    currency: samplePartnerNetwork.currency,
    roles: 'admin'
}];
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };

describe('accept Partner Network Member', () => {
    before(async () => {
        await request.post(helpers.API_URL + '/api/v1/partner-networks', {
            body: samplePartnerNetwork,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        await request.post(process.env.MERCHANTS_API_URL + '/api/' + process.env.MERCHANTS_API_VERSION + '/merchants', {
            body: sampleMerchant,
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });

        await request.patch(`${helpers.API_URL}/api/v1/send-partner-network-member-request`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                partnerNetworkID: samplePartnerNetwork._id,
                requestedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: merchantID,
                inviteCode: samplePartnerNetwork.inviteCode
            }
        });
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(helpers.API_URL + '/api/v1/accept-partner-network-member', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to accept partner network member but the request body seems to be empty. Kindly pass the request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
            
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/accept-partner-network-member`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    partnerNetworkID: '123'
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The id field specified in the request body does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if partnerNetworks not exist of specified details', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/accept-partner-network-member`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    partnerNetworkID: uuid.v4()
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
        const result = await request.patch(`${helpers.API_URL}/api/v1/accept-partner-network-member`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                partnerNetworkID: samplePartnerNetwork._id,
                requestedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: merchantID
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully accept partner network member request'
        });
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
        await request.delete(`${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${merchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });
    });
});