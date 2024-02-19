'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
samplePartnerNetwork.ownerMerchantID = merchantID;
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: samplePartnerNetwork.ownerMerchantID,
    merchantName: samplePartnerNetwork.ownerMerchantName,
    commissionPercent: samplePartnerNetwork.commissionPercent,
    currency: samplePartnerNetwork.currency,
    roles: 'admin'
}];

describe('deny-partnernetwork-invite', () => {
    before(async () => {
        await request.post(process.env.MERCHANTS_API_URL + '/api/' + process.env.MERCHANTS_API_VERSION + '/merchants', {
            body: sampleMerchant,
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });
        samplePartnerNetwork.partnerNetworkMembers[0].roles = 'admin';
        await request.post(helpers.API_URL + '/api/v1/partner-networks', {
            body: samplePartnerNetwork,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        await request.patch(`${helpers.API_URL}/api/v1/invite-merchant`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                partnerNetworkID: samplePartnerNetwork._id,
                invitedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: merchantID,
                role: 'admin'
            }
        });
    });

    it('should return status code 400 when request don\'t have partnerNetworkId in input query request', async () => {
        try {
            await request.patch(helpers.API_URL + '/api/v1/merchant/123/deny-partner-network-invite', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'Field partnerNetworkID is missing from request query params.',
                reasonPhrase: 'FieldValidationError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
            
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/123/deny-partner-network-invite?partnerNetworkID=123`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The id field specified in the request does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error if merchantPartnerNetworks not exist of specified details', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/${uuid.v4()}/deny-partner-network-invite?partnerNetworkID=${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The merchant partner network of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'MerchantPartnerNetworkNotFoundError'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });


    it('should throw error if partnerNetworks not linked with this merchant', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/${merchantID}/deny-partner-network-invite?partnerNetworkID=${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'This merchant is not invited for this partner network.',
                reasonPhrase: 'PartnerNetworkNotInvited'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return document when all validation passes', async () => {
        const result = await request.patch(`${helpers.API_URL}/api/v1/merchant/${merchantID}/deny-partner-network-invite?partnerNetworkID=${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully deny partner network invite request.'
        });
    });

    after(async () => {
        await request.delete(helpers.API_URL + `/api/v1/merchants/${merchantID}/partner-networks/${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        await request.delete(`${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${sampleMerchant._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });
    });
});