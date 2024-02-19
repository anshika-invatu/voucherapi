'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucherBundle = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucherBundle.partitionKey = uuid.v4();

describe('Create voucher', () => {

    it('should return status code 400 when request body is null', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/voucherBundle', {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'You\'ve requested to create a new voucherBundle but the request body seems to be empty. Kindly pass the voucherBundle to be created using request body in application/json format',
                reasonPhrase: 'EmptyRequestBodyError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should throw error on incorrect _id field', async () => {
        try {
            await request.post(helpers.API_URL + '/api/v1/voucherBundle', {
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

        const voucherBundle = await request.post(helpers.API_URL + '/api/v1/voucherBundle', {
            body: sampleVoucherBundle,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(voucherBundle).not.to.be.null;
        expect(voucherBundle._id).to.equal(sampleVoucherBundle._id);
        expect(voucherBundle.docType).to.equal('voucherBundle');

        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucherBundle._id, docType: 'voucherBundle', partitionKey: sampleVoucherBundle.partitionKey.toLowerCase() });
    });

});