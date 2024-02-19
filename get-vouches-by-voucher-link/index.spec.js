'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const utils = require('../utils');
const sampleVoucherLink = { ...require('../spec/sample-docs/VoucherLink'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: uuid.v4() };
sampleVoucher.passToken = utils.hashToken(sampleVoucher.passToken);

describe('Get Vouches By LinkedID and PartnerNetworkID', () => {
    before(async () => {
        sampleVoucherLink.voucherID = sampleVoucher._id;
        sampleVoucherLink.passToken = sampleVoucher.passToken;
        sampleVoucher.voucherToken = sampleVoucher.voucherToken;
        sampleVoucherLink.partitionKey = uuid.v4();
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLink);
        await request.post(helpers.API_URL + '/api/v1/vouchers', {
            body: sampleVoucher,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
    });

    it('should throw error on incorrect id field', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/voucher/${sampleVoucherLink.linkedID}?partnerNetworkID=123-abc`, {
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

    it('should throw 404 error if the documentId is invalid', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/voucher/${sampleVoucherLink.linkedID}?partnerNetworkID=${uuid.v4()}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                reasonPhrase: 'VoucherLinkNotFoundError'
            };

            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return the document when all validation passes', async () => {
        const voucherLink = await request
            .get(`${helpers.API_URL}/api/v1/voucher/${sampleVoucherLink.linkedID}?partnerNetworkID=${sampleVoucherLink.partitionKey}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

        expect(voucherLink).not.to.be.null;
        expect(voucherLink.partitionKey).to.equal(sampleVoucher.passToken);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucherLink._id, docType: 'voucherLink', partitionKey: sampleVoucherLink.partitionKey });

        await request.delete(`${helpers.API_URL}/api/v1/vouchers/${sampleVoucher._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
    });
});