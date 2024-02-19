'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4() };
const samplePass = { ...require('../spec/sample-docs/Passes'), _id: uuid.v4(),passToken: uuid.v4() };
const utils = require('../utils');
const id1 = uuid.v4();
const id2 = uuid.v4();
const { getMongodbCollection } = require('../db/mongodb');


describe('Get Vouchers by PassID', () => {

    before(async () => {
        var collection = await getMongodbCollection('Passes');
        samplePass.partitionKey = samplePass._id;
        await collection.insertOne(samplePass);
        collection = await getMongodbCollection('Vouchers');
        sampleVoucher.passToken = utils.hashToken(samplePass.passToken);
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        await collection.insertOne(sampleVoucher);
        await collection.insertOne({
            ...sampleVoucher,
            _id: id1,
            voucherToken: uuid.v4()
        });
        await collection.insertOne({
            ...sampleVoucher,
            _id: id2,
            voucherToken: uuid.v4()
        });
    });

    it('should throw error on incorrect pass id field', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/passes/123-abc/vouchers`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The pass id specified in the URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return empty array when no linked vouchers found to the pass id provided', async () => {
        const url = `${helpers.API_URL}/api/v1/passes/12358cfa-063d-4f5c-be5d-b90cfb64d321/vouchers`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(0);
    });

    it('should return vouchers linked to pass id provided', async () => {
        const url = `${helpers.API_URL}/api/v1/passes/${samplePass._id}/vouchers`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        const vouchersTypes = vouchers.map(pass => pass.docType === 'vouchers');

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(3);
        expect(vouchersTypes).to.have.lengthOf(3);
    });

    after(async () => {
        var collection = await getMongodbCollection('Passes');
        await collection.deleteOne({ _id: samplePass._id, docType: 'passes', partitionKey: samplePass._id });
        collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: id1, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: id2, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
    });
});