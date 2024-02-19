'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const utils = require('../utils');
const sampleVoucherLink = { ...require('../spec/sample-docs/VoucherLink'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
const linkedID = uuid.v4();

describe('Delete Voucher Link', () => {
    before(async () => {
        sampleVoucherLink.partitionKey = uuid.v4();
        sampleVoucherLink.linkedID = linkedID.trim();
        sampleVoucherLink.linkedID = utils.hashToken(sampleVoucherLink.linkedID).toLowerCase();
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLink);
    });

    it('should throw error if linkedID not in url', async () => {
        try {
            await request.delete(`${helpers.API_URL}/api/v1/voucher-link/${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 409,
                description: 'partnerNetworkID is not present in req url.',
                reasonPhrase: 'FieldValidationError'
            };

            expect(error.statusCode).to.equal(409);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect id field', async () => {
        try {
            await request.delete(`${helpers.API_URL}/api/v1/voucher-link/123-abc?partnerNetworkID=${uuid.v4()}`, {
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

    it('should throw 404 error if the documentId is invalid', async () => {
        try {
            await request.delete(`${helpers.API_URL}/api/v1/voucher-link/${uuid.v4()}?partnerNetworkID=${sampleVoucherLink.partitionKey}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The voucherLink _id specified in the URL doesn\'t exist.',
                reasonPhrase: 'VoucherLinkNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return the document when all validation passes', async () => {
        const voucherLink = await request
            .delete(`${helpers.API_URL}/api/v1/voucher-link/${sampleVoucherLink._id}?partnerNetworkID=${sampleVoucherLink.partitionKey}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

        expect(voucherLink).not.to.be.null;
        expect(voucherLink.description).to.equal('Successfully deleted the specified voucher-link');
    });

});