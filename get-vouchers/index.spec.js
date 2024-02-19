'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const passToken = uuid.v4();
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const sampleVoucher2 = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: passToken, voucherToken: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');

describe('Get Vouchers', () => {

    before(async () => {
        sampleVoucher.partitionKey = sampleVoucher.passToken;
        sampleVoucher2.partitionKey = sampleVoucher2.passToken;
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucher);
        await collection.insertOne(sampleVoucher2);
    });

    it('should throw error when passToken is not sent', async () => {
        try {
            await request.get(`${helpers.API_URL}/api/v1/vouchers`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'Field passToken is missing from request query params.',
                reasonPhrase: 'MissingPassTokenError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });

    it('should return empty array when no vouchers are matched', async () => {
        const url = `${helpers.API_URL}/api/v1/vouchers?passToken=12345`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(0);
    });

    it('should return vouchers matching the passToken', async () => {
        const url = `${helpers.API_URL}/api/v1/vouchers?passToken=${sampleVoucher.passToken}`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        const voucherTypes = vouchers.map(voucher => voucher.docType === 'vouchers');

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(2);
        expect(voucherTypes).to.have.lengthOf(2);
    });

    it('should perform case insensitive passToken match', async () => {
        const passToken = sampleVoucher.passToken.toUpperCase();
        const url = `${helpers.API_URL}/api/v1/vouchers?passToken=${passToken}`;
        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        const voucherTypes = vouchers.filter(voucher => voucher.docType === 'vouchers');
        const passTokens = vouchers.map(voucher => voucher.passToken);

        expect(passTokens).to.not.include(passToken);

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(2);
        expect(voucherTypes).to.have.lengthOf(2);
    });

    it('should return single voucher if voucherToken is specified', async () => {
        let url = `${helpers.API_URL}/api/v1/vouchers?passToken=${sampleVoucher.passToken}`;
        url += `&voucherToken=${sampleVoucher.voucherToken}`;

        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(1);
        expect(vouchers[0].docType).to.equal('vouchers');
    });

    it('should return empty arry when passToken is valid and voucherToken is invalid', async () => {
        let url = `${helpers.API_URL}/api/v1/vouchers?passToken=${sampleVoucher.passToken}`;
        url += '&voucherToken=12345';

        const vouchers = await request.get(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(vouchers).to.be.instanceOf(Array).and.have.lengthOf(0);
    });

    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: sampleVoucher._id, docType: 'vouchers', partitionKey: sampleVoucher.passToken });
        await collection.deleteOne({ _id: sampleVoucher2._id, docType: 'vouchers', partitionKey: sampleVoucher2.passToken });
    });
});