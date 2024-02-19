'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID  = uuid.v4();
const sampleMerchantPartnerNetworks = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
const { getMongodbCollection } = require('../db/mongodb');
sampleMerchantPartnerNetworks.merchantID = merchantID;
sampleMerchantPartnerNetworks.partitionKey = merchantID;
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: samplePartnerNetwork.ownerMerchantID,
    merchantName: samplePartnerNetwork.ownerMerchantName,
    commissionPercent: samplePartnerNetwork.commissionPercent,
    currency: samplePartnerNetwork.currency,
    roles: 'admin'
}];
sampleMerchantPartnerNetworks.partnerNetworkInvites = [
    {
        partnerNetworkID: '674b917c-9971-4ec4-89b5-0ab80f2607ae',
        partnerNetworkName: 'Network 3',
        roles: 'member',
        inviteExpiryDate: '2019-10-16T14:05:36Z'
    }
];

describe('Invite Merchant', () => {
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
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(helpers.API_URL + '/api/v1/invite-merchant', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to invite a partnerNetwork but the request body seems to be empty. Kindly pass the request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
            
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(`${helpers.API_URL}/api/v1/invite-merchant`, {
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
            await request.patch(`${helpers.API_URL}/api/v1/invite-merchant`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    partnerNetworkID: uuid.v4(),
                    merchantID: merchantID
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
        const result = await request.patch(`${helpers.API_URL}/api/v1/invite-merchant`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                partnerNetworkID: samplePartnerNetwork._id,
                invitedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: merchantID,
                roles: 'admin'
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully invited the partnerNetwork'
        });
        const result1 = await request.get(helpers.API_URL + `/api/v1/merchant/${merchantID}/merchant-partner-networks`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result1).not.to.be.null;
        expect(result1.partnerNetworkInvites).to.be.instanceOf(Array).and.have.lengthOf(1);
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ merchantID: merchantID, docType: 'merchantPartnerNetworks', partitionKey: merchantID });

    });

    it('should return document when all validation passes', async () => {
        await request.delete(helpers.API_URL + `/api/v1/merchants/${samplePartnerNetwork.ownerMerchantID}/partner-networks/${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        await request.post(helpers.API_URL + '/api/v1/partner-networks', {
            body: samplePartnerNetwork,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMerchantPartnerNetworks);
        const result = await request.patch(`${helpers.API_URL}/api/v1/invite-merchant`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            },
            body: {
                partnerNetworkID: samplePartnerNetwork._id,
                invitedMerchantID: samplePartnerNetwork.partnerNetworkMembers[0].merchantID,
                merchantID: merchantID,
                roles: 'admin'
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully invited the partnerNetwork'
        });
        const result1 = await request.get(helpers.API_URL + `/api/v1/merchant/${merchantID}/merchant-partner-networks`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result1).not.to.be.null;
        expect(result1.partnerNetworkInvites).to.be.instanceOf(Array).and.have.lengthOf(2);
        await collection.deleteOne({ _id: sampleMerchantPartnerNetworks._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetworks.merchantID });
    });

    after(async () => {
        await request.delete(helpers.API_URL + `/api/v1/merchants/${samplePartnerNetwork.ownerMerchantID}/partner-networks/${samplePartnerNetwork._id}`, {
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