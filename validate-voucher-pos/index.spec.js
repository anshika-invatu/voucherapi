'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const utils = require('../utils');
const Promise = require('bluebird');
const passToken = uuid.v4();
const merchantID = uuid.v4();
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), isMultiFunctionVoucher: true,voucherToken: uuid.v4(),balanceAccountID: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: sampleVoucher.balanceAccountID };
const moment = require('moment');
const { getMongodbCollection } = require('../db/mongodb');
sampleVoucher.issuer.merchantID = merchantID;
sampleVoucher.issuer.merchantName = sampleMerchant.merchantName;
sampleVoucher.partitionKey = sampleVoucher.passToken;
sampleVoucher.collectorLimitationsMerchants = [];
sampleMerchant.partitionKey = sampleMerchant._id;
sampleVoucher.settlementList.settleValueOnRedemption = 'fixedamount';
sampleVoucher.settlementList.totalSettlementAmount = 50;
sampleVoucher.collectorLimitationsMerchants.push({
    merchantID: merchantID,
    merchantName: sampleMerchant.merchantName,
    balanceAccountID: sampleBalanceAccount._id
});
sampleVoucher.currency = 'SEK';
sampleVoucher.voucherValue.currency = 'SEK';
sampleBalanceAccount.issuerMerchantID = merchantID;
sampleBalanceAccount.partitionKey = sampleBalanceAccount._id;

describe('validate-voucher-pos', () => {
    before(async () => {
        await request.post(process.env.MERCHANTS_API_URL + '/api/' + process.env.MERCHANTS_API_VERSION + '/merchants', {
            body: sampleMerchant,
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });
        await request.post(helpers.API_URL + '/api/v1/balance-accounts', {
            body: sampleBalanceAccount,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
    });
    describe('Validations', () => {
        it('should return status code 400 when request body is null', async () => {
            try {
                await request.put(`${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'You\'ve requested to redeem a voucher but the request body seems to be empty. Kindly specify the merchant_voucher properties to be redeemded using request body in application/json format',
                    reasonPhrase: 'EmptyRequestBodyError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should return status code 400 when passToken is missing from queryParams', async () => {
            try {
                await request.put(`${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
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
        it('should return status code 400 when voucherToken is missing from queryParams', async () => {
            try {
                await request.put(`${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=123`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'Field voucherToken is missing from request query params.',
                    reasonPhrase: 'MissingVoucherTokenError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should validate voucherToken to match UUID v4 format', async () => {
            try {
                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=123`;
                url += '&voucherToken=123456';
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The voucherToken specified in the URL does not match UUID v4 format.',
                    reasonPhrase: 'InvalidUUIDError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should return status code 404 if the voucher does not exist', async () => {
            try {
                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=123`;
                url += `&voucherToken=${sampleVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
                });
            } catch (error) {
                const response = {
                    code: 404,
                    description: 'We could not find a voucher matching the specified voucherToken and passToken. Kindly verify the tokens and try again.',
                    reasonPhrase: 'VoucherNotFoundError'
                };
                expect(error.statusCode).to.equal(404);
                expect(error.error).to.eql(response);
            }
        });
        it('should validate if the voucher has already been redeemed', async () => {
            try {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: true
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The voucher you\'ve requested to redeem has already been redeemed',
                    reasonPhrase: 'VoucherRedeemdedError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate if the voucher is locked', async () => {
            try {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isLocked: true,
                        isRedeemed: false
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'Voucher is locked. Ask customer to unlock it before it can be redeemed',
                    reasonPhrase: 'VoucherLockedError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate if the voucher is expired', async () => {
            try {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isExpired: true
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The voucher you\'ve requested to redeem has expired.',
                    reasonPhrase: 'VoucherExpiredError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate if the req body currency mismatch with voucher currency', async () => {
            try {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: 'SDK',
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 401,
                    description: 'The currency specified in the request body does not match the voucher currency.',
                    reasonPhrase: 'VoucherCurrencyMismatchError'
                };
                expect(error.statusCode).to.equal(401);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate redemption weekday if specified', async () => {
            let validWeekDayMoments;
            try {
                validWeekDayMoments = [
                    moment.utc().add(1, 'day'),
                    moment.utc().add(2, 'day')
                ];

                const validDaysOfWeek = validWeekDayMoments.map(
                    date => date.format('dd')
                );

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {
                            validDaysOfWeek: validDaysOfWeek.join(',')
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const validWeekdays = validWeekDayMoments.map(
                    date => date.format('dddd')
                );
                const response = {
                    code: 400,
                    description: `The voucher you've requested to redeem can only be redeemded on ${validWeekdays.join(', ')}`,
                    reasonPhrase: 'VoucherValidWeekdaysError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
                // Remove sample document
                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            }
        });
        it('should validate time range if specified', async () => {
            let validFromTime, validToTime;
            try {
                validFromTime = moment
                    .utc()
                    .add(3, 'hours')
                    .format('HH:mm:ss');

                validToTime = moment
                    .utc()
                    .add(4, 'hours')
                    .format('HH:mm:ss');

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {
                            validFromTime,
                            validToTime
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: `This voucher you've requested to redeem is only valid for redemption between ${validFromTime} to ${validToTime}`,
                    reasonPhrase: 'VoucherValidTimeError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

        });
        it('should validate redemptionCode if redemption code is required', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        voucherPinCode: null,
                        redemptionRules: {
                            redemptionCodeIsRequired: true,
                            redemptionCodes: [

                            ]
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        redemptionCode: 123
                    }
                });
            } catch (error) {
                const response = {
                    code: 401,
                    description: 'The redemptionCode specified in the request body is incorrect. Kindly verify the redemptionCode and try again.',
                    reasonPhrase: 'IncorrectRedemptionCodeError'
                };

                expect(error.statusCode).to.equal(401);
                expect(error.error).to.eql(response);
                
                // Remove sample document
                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            }
        });
        it('should validate missing salesPersonCode if sales person code is required', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        voucherPinCode: null,
                        redemptionRules: {
                            salesPersonCodeIsRequired: true
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'Field salesPersonCode is missing from request body.',
                    reasonPhrase: 'MissingSalesPersonCodeError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
    });

    describe('Monetary voucher', () => {

        it('should validate missing fixedAmount if voucher type is monetary', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        redemptionRules: {},
                        voucherValue: {
                            valueType: 'monetary'
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: merchantID
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'Field fixedAmount is missing from request body.',
                    reasonPhrase: 'MissingFixedAmountError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

        });
        it('should validate voucher currency with redemption currency', async () => {
            try {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        redemptionRules: {}
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        fixedAmount: 120.23,
                        currency: 'UNK'
                    }
                });
            } catch (error) {
                const response = {
                    code: 401,
                    description: 'The currency specified in the request body does not match the voucher currency.',
                    reasonPhrase: 'VoucherCurrencyMismatchError'
                };
                expect(error.statusCode).to.equal(401);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate redemption currency when it exceeds voucher currency', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        redemptionRules: {},
                        voucherValue: {
                            fixedAmount: 25.50,
                            valueType: 'monetary',
                            currency: 'SEK'
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        fixedAmount: 30
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The amount specified in the request body exceeds the value of the voucher.',
                    reasonPhrase: 'RedemptionFixedAmountExceededError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }

            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should not validate voucher if redemptionLeft is less than spend', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        voucherValue: {
                            fixedAmount: 25.50,
                            currency: 'SEK',
                            valueType: 'monetary',
                            redemptionsLeft: 0,
                            spend: 1
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        fixedAmount: 20,
                        redemptionsCount: 1
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The voucher you have requested to redeem has no redemptions left.',
                    reasonPhrase: 'NoRedemptionsLeftError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate voucher if all validations pass', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'monetary',
                        redemptionsLeft: 1,
                        spend: 1
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
            url += `&voucherToken=${testVoucher.voucherToken}`;
            const result = await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 20
                }
            });
            expect(result).not.to.be.null;
            expect(result.description).to.equal('Successfully validate the voucher');
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should validate voucher if merchantID not provided in request body', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'monetary',
                        redemptionsLeft: 1,
                        spend: 1
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
            url += `&voucherToken=${testVoucher.voucherToken}`;
            const result = await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    currency: sampleVoucher.currency,
                    fixedAmount: 20
                }
            });
            expect(result).not.to.be.null;
            expect(result.description).to.equal('Successfully validate the voucher');
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
    });
    
    describe('Exchange voucher', () => {
        it('should not validate voucher if redemptionLeft is less than spend', async () => {
            try {
                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        voucherValue: {
                            fixedAmount: 25.50,
                            currency: 'SEK',
                            valueType: 'exchange',
                            redemptionsLeft: 0,
                            spend: 1,
                            settleValueOnRedemption: 'fullonfirstredemption'
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/validate-voucher-pos?passToken=${testVoucher.passToken}`;
                url += `&voucherToken=${testVoucher.voucherToken}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        fixedAmount: 20,
                        currency: 'SEK',
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        redemptionsCount: 1
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'The voucher you have requested to redeem has no redemptions left.',
                    reasonPhrase: 'NoRedemptionsLeftError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
    });
    after(async () => {
        await request.delete(`${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${sampleMerchant._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.MERCHANTS_API_KEY
            }
        });
        await request.delete(helpers.API_URL + '/api/v1/balance-accounts/' + sampleBalanceAccount._id + '?merchantID=' + merchantID, {
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        await Promise.delay(50000);
        const collection = await getMongodbCollection('Vouchers');
        const result =  await  collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        if (result.deletedCount === 0) {
            throw 'voucherLog not deleted';
        }
        console.log(result.deletedCount);
        await deleteBlob();
       
        const redemptionDoc = await collection.find({ docType: 'redemption', voucherID: sampleVoucher._id }).toArray();
       
        const allRedemptionRequest = [];
        redemptionDoc.forEach(element => {
            allRedemptionRequest.push(collection.deleteOne({ docType: 'redemption', _id: element._id, partitionKey: element._id }));
        });
        await Promise.all(allRedemptionRequest);
    });
});
async function deleteBlob () {
    
    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerName = process.env.BLOB_CONTAINER;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const iter = containerClient.listBlobsFlat();
    let blobItem = await iter.next();
    while (!blobItem.done) {
        if (blobItem.value.name.includes('Voucher_' + sampleVoucher._id)) {
            
            containerClient.deleteBlob(blobItem.value.name);
        }
        blobItem = await iter.next();
    }
}