'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const merchantID1 = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.ownerMerchantID = merchantID;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 17.50,
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

describe('Remove Own Membership', () => {
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

    it('should return error when id is invalid', async () => {
        try {
            await request.delete(helpers.API_URL + `/api/v1/merchant/${uuid.v4()}/remove-membership?partnerNetworkID=123`, {
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
            await request.delete(helpers.API_URL + `/api/v1/merchant/${uuid.v4()}/remove-membership?partnerNetworkID=${uuid.v4()}`, {
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

    it('should throw error if merchant is not a member', async () => {
        try {
            await request.delete(helpers.API_URL + `/api/v1/merchant/${uuid.v4()}/remove-membership?partnerNetworkID=${samplePartnerNetwork._id}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'This merchant is not a member of this partner network.',
                reasonPhrase: 'MerchantNotMemberError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should delete partnere network member when all validation passes', async () => {
        const collection = await getMongodbCollection('Vouchers');
        const merchantPartnerNetworkDoc = await collection.findOne({ merchantID: merchantID, docType: 'merchantPartnerNetworks', partitionKey: merchantID });
        expect(merchantPartnerNetworkDoc.partnerNetworkMemberships.find(x=>x.partnerNetworkID === samplePartnerNetwork._id)).to.not.eql(undefined);
    
        const url = helpers.API_URL + `/api/v1/merchant/${merchantID}/remove-membership?partnerNetworkID=${samplePartnerNetwork._id}`;
        const result = await request.delete(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.eql({
            code: 200,
            description: 'Successfully deleted own membership from the partner network'
        });
        
        const partnerNetwork = await collection.findOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
       
        expect(partnerNetwork.partnerNetworkMembers.find(x=>x.merchantID === merchantID)).to.eql(undefined);
        expect(partnerNetwork.partnerNetworkMembers.find(x=>x.merchantID === merchantID1)).to.not.eql(undefined);

        const merchantPartnerNetwork = await collection.findOne({ merchantID: merchantID, docType: 'merchantPartnerNetworks', partitionKey: merchantID });
        expect(merchantPartnerNetwork.partnerNetworkMemberships.find(x=>x.partnerNetworkID === samplePartnerNetwork._id)).to.eql(undefined);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});