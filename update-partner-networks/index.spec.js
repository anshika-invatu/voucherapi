'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID1 = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID1,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
}];

describe('Update Partner Network', () => {
    before(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
    });

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/partner-networks/${123}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to update a partnerNetwork but the request body seems to be empty. Kindly pass the partnerNetwork fields to be updated using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.patch(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/partner-networks/${123}`, {
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
            await request.patch(helpers.API_URL + `/api/v1/merchants/${uuid.v4()}/partner-networks/${uuid.v4()}`, {
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
        
        const url = helpers.API_URL + `/api/v1/merchants/${merchantID1}/partner-networks/${samplePartnerNetwork._id}`;
        const result = await request.patch(url, {
            body: {
                isVisible: false
            },
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result._id).to.eql(samplePartnerNetwork._id);
    });

    it('should update document when all validation passes', async () => {
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
        //expect(result.partnerNetworkName).to.eql('test');
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});