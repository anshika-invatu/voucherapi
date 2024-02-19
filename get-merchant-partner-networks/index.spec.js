'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleMerchantPartnerNetworks = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4(), merchantID: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
sampleMerchantPartnerNetworks.partitionKey = sampleMerchantPartnerNetworks.merchantID;

describe('Get Partner Network', () => {
    before(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleMerchantPartnerNetworks);
    });

    it('should return error when id is invalid', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/merchant/${123}/merchant-partner-networks`, {
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

    it('should throw error if merchantPartnerNetworks not exist of specified details', async () => {
        try {
            await request.get(helpers.API_URL + `/api/v1/merchant/${uuid.v4()}/merchant-partner-networks`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The merchantPartnerNetworks of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'MerchantPartnerNetworkNotFoundError'
            };
            
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return document when all validation passes', async () => {
        const result = await request.get(helpers.API_URL + `/api/v1/merchant/${sampleMerchantPartnerNetworks.merchantID}/merchant-partner-networks`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result._id).to.be.equal(sampleMerchantPartnerNetworks._id);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleMerchantPartnerNetworks._id, docType: 'merchantPartnerNetworks', partitionKey: sampleMerchantPartnerNetworks.merchantID });
    });
});