'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const merchantID1 = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
samplePartnerNetwork.ownerMerchantID = merchantID;
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
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

describe('deny-partner-member-request', () => {
    before(async () => {
        samplePartnerNetwork.partnerNetworkMembers[0].roles = 'admin';
        await request.post(helpers.API_URL + '/api/v1/partner-networks', {
            body: samplePartnerNetwork,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

    });

    
    it('should return status code 400 when request don\'t have partnerNetworkId in input query request', async () => {
        try {
            await request.patch(helpers.API_URL + '/api/v1/merchant/123/deny-partner-member-request', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'Field partnerNetworkID and requestedMerchantID is missing from request query params.',
                reasonPhrase: 'FieldValidationError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
            
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/123/deny-partner-member-request?partnerNetworkID=123&requestedMerchantID=${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
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

    it('should throw error if merchantPartnerNetworks not exist of specified details', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/${uuid.v4()}/deny-partner-member-request?partnerNetworkID=${uuid.v4()}&requestedMerchantID=${merchantID}`, {
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

    it('should throw error if merchant is not present in partner network member request', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/merchant/${uuid.v4()}/deny-partner-member-request?partnerNetworkID=${samplePartnerNetwork._id}&requestedMerchantID=${merchantID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'This merchant is not a available in partner network request.',
                reasonPhrase: 'MerchantNotMemberError'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });


    it('should return document when all validation passes', async () => {
        const result = await request.patch(`${helpers.API_URL}/api/v1/merchant/${samplePartnerNetwork.partnerNetworkRequests[0].merchantID}/deny-partner-member-request?partnerNetworkID=${samplePartnerNetwork._id}&requestedMerchantID=${merchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully deny partner network member request.'
        });
    });

    after(async () => {
    
        await request.delete(helpers.API_URL + `/api/v1/merchants/${merchantID}/partner-networks/${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
    });
});