'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;

describe('Create Partner Network', () => {

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/partner-networks', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to create a new partnerNetwork the request body seems to be empty. Kindly pass the partnerNetwork to be created using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
            
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/partner-networks', {
                body: {
                    _id: 123
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The _id field specified in the request body does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };
            
            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should create document when all validation passes', async () => {
        const result = await request.post(helpers.API_URL + '/api/v1/partner-networks', {
            body: samplePartnerNetwork,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result._id).to.equal(samplePartnerNetwork._id);
        expect(result.docType).to.equal('partnerNetworks');
        const collection = await getMongodbCollection('Vouchers');
        const merchantPartnerNetworks = await collection.findOne({ merchantID: samplePartnerNetwork.ownerMerchantID, docType: 'merchantPartnerNetworks', partitionKey: samplePartnerNetwork.ownerMerchantID });
        expect(merchantPartnerNetworks).not.to.be.null;
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});