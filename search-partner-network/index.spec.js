'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const crypto = require('crypto');
const randomString = crypto.randomBytes(3).toString('hex');
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const samplePartnerNetwork1 = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork1.partitionKey = samplePartnerNetwork1._id;
samplePartnerNetwork.ownerMerchantID = uuid.v4();
samplePartnerNetwork1.ownerMerchantID = uuid.v4();
samplePartnerNetwork.partnerNetworkName = randomString;
samplePartnerNetwork1.partnerNetworkName = randomString;

describe('Search Partner Network', () => {
    before(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
        await collection.insertOne(samplePartnerNetwork1);
    });

    it('should return error if partnerNetworks not exist of specified details', async () => {

        try {
            await request.get(helpers.API_URL + `/api/v1/search-partner-network?partnerNetworkID=${uuid.v4()}`, {
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

    it('should return document when all validation passes with one parameter', async () => {
        const result = await request.get(helpers.API_URL + `/api/v1/search-partner-network?partnerNetworkID=${samplePartnerNetwork._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result[0]._id).to.be.equal(samplePartnerNetwork._id);
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(1);
    });

    it('should return document when all validation passes with two parameter', async () => {
        const result = await request.get(helpers.API_URL + `/api/v1/search-partner-network?partnerNetworkID=${samplePartnerNetwork._id}&partnerNetworkName=${samplePartnerNetwork.partnerNetworkName}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result[0]._id).to.be.equal(samplePartnerNetwork._id);
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(1);
    });

    it('should return document when all validation passes with three parameter', async () => {
        const result = await request.get(helpers.API_URL + `/api/v1/search-partner-network?partnerNetworkID=${samplePartnerNetwork._id}&partnerNetworkName=${randomString}&merchantID=${samplePartnerNetwork.ownerMerchantID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result[0]._id).to.be.equal(samplePartnerNetwork._id);
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(1);
    });

    it('should return document when all validation passes with one parameter', async () => {
        const result = await request.get(helpers.API_URL + `/api/v1/search-partner-network?partnerNetworkName=${randomString}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(result).not.to.be.null;
        expect(result).to.be.instanceOf(Array).and.have.lengthOf(2);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
        await collection.deleteOne({ _id: samplePartnerNetwork1._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork1._id });
    });
});