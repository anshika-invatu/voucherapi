'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const { getMongodbCollection } = require('../db/mongodb');


const sampleVoucherLink = {
    partnerNetworkID: uuid.v4(),
    externalID: uuid.v4(),
    passToken: uuid.v4(),
    voucherID: uuid.v4(),
    linkedIDName: 'some text'
};

describe('Create Voucher Link', () => {

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers-link', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to create a new voucher-link but the request body seems to be empty. Kindly pass the voucher-link to be created using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers-link', {
                body: {
                    partnerNetworkID: 123
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The partnerNetworkID field specified in the request body does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should create document when all validation passes', async () => {

        const voucherLinkDoc = await request.post(helpers.API_URL + '/api/v1/vouchers-link', {
            body: sampleVoucherLink,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucherLinkDoc).not.to.be.null;
        expect(voucherLinkDoc.docType).to.equal('voucherLink');
        expect(voucherLinkDoc.partitionKey).to.equal(sampleVoucherLink.partnerNetworkID);

    });

    it('should throw error if the document already exists', async () => {

        const collection = await getMongodbCollection('Vouchers');
        try {
            await request.post(helpers.API_URL + '/api/v1/vouchers-link', {
                body: sampleVoucherLink,
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 409,
                description: 'VoucherLink is already exist with this linkedID for this partner network.',
                reasonPhrase: 'DuplicateVoucherLinkError'
            };

            expect(error.statusCode).to.equal(409);
            expect(error.error).to.eql(response);
        }
        await collection.deleteOne({ docType: 'voucherLink', partitionKey: sampleVoucherLink.partnerNetworkID });
    });

});