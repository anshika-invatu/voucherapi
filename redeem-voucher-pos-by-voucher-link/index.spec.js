'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const utils = require('../utils');
const passToken = uuid.v4();
const Promise = require('bluebird');
const merchantID = uuid.v4();
const partnerNetworkID = uuid.v4();
const { BlobServiceClient } = require('@azure/storage-blob');
const sampleVoucher = { ...require('../spec/sample-docs/Vouchers'), _id: uuid.v4(), passToken: utils.hashToken(passToken), isMultiFunctionVoucher: true, voucherToken: uuid.v4(), balanceAccountID: uuid.v4() };
const sampleMerchant = { ...require('../spec/sample-docs/Merchants'), _id: merchantID };
const sampleBalanceAccount = { ...require('../spec/sample-docs/BalanceAccount'), _id: sampleVoucher.balanceAccountID };
const sampleVoucherLink = { ...require('../spec/sample-docs/VoucherLink'), _id: uuid.v4() };
const moment = require('moment');
const sampleMerchantPartnerNetworks = { ...require('../spec/sample-docs/MerchantPartnerNetworks'), _id: uuid.v4(), merchantID: merchantID };
sampleMerchantPartnerNetworks.partitionKey = sampleMerchantPartnerNetworks.merchantID;
const { getMongodbCollection, getMongodbCollectionRegional } = require('../db/mongodb');
sampleVoucher.issuer =
    {
        merchantID: merchantID,
        merchantName: sampleMerchant.merchantName
    };
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
sampleBalanceAccount.balanceAmount = 1235654546978515456;
sampleBalanceAccount.creditLimit = 500000;

describe('redeem-voucher-pos-by-voucher-link', () => {
    before(async () => {
        sampleVoucherLink.voucherID = sampleVoucher._id;
        sampleVoucherLink.passToken = sampleVoucher.passToken;
        sampleVoucherLink.voucherToken = sampleVoucher.voucherToken;
        sampleVoucherLink.partitionKey = uuid.v4();
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(sampleVoucherLink);
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
                await request.put(`${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link`, {
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
        it('should return status code 400 when partnerNetworkID is missing from queryParams', async () => {
            try {
                await request.put(`${helpers.API_URL}/api/v1/vouchers/redeem-voucher-merchant-voucher-link`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
                });
            } catch (error) {

                const response = {
                    code: 400,
                    description: 'Field partnerNetworkID is missing from request query params.',
                    reasonPhrase: 'MissingPartnerNetworkIDError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should return status code 400 when linkedID is missing from queryParams', async () => {
            try {
                await request.put(`${helpers.API_URL}/api/v1/vouchers/redeem-voucher-merchant-voucher-link?partnerNetworkID=123`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {}
                });
            } catch (error) {

                const response = {
                    code: 400,
                    description: 'Field linkedID is missing from request query params.',
                    reasonPhrase: 'MissingLinkedIDError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should validate partnerNetworkID to match UUID v4 format', async () => {
            try {
                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=123`;
                url += '&linkedID=123456';
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
                    description: 'The partnerNetworkID specified in the URL does not match UUID v4 format.',
                    reasonPhrase: 'InvalidUUIDError'
                };
                expect(error.statusCode).to.equal(400);
                expect(error.error).to.eql(response);
            }
        });
        it('should return status code 404 if the voucher does not exist', async () => {
            try {
                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?linkedID=123`;
                url += `&partnerNetworkID=${sampleVoucher.voucherToken}`;
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
                    description: 'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                    reasonPhrase: 'VoucherLinkNotFoundError'
                };
                expect(error.statusCode).to.equal(404);
                expect(error.error).to.eql(response);
            }
        });
        it('should validate if the voucher has already been redeemed', async () => {
            try {
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: true
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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
                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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
        it('should validate if the voucher has expired', async () => {
            try {

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {
                            validFromDate: new Date('2017-01-01'),
                            validToDate: new Date('2017-02-01')
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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
        it('should validate missing merchantID if merchantID is required', async () => {
            try {

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345'
                    }
                });
            } catch (error) {
                const response = {
                    code: 400,
                    description: 'Field merchantID is missing from request body.',
                    reasonPhrase: 'MissingMerchantIDError'
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
        it('should validate req body merchantID linked to the voucher.', async () => {
            try {

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        currency: sampleVoucher.currency,
                        salesPersonCode: '12345',
                        merchantID: uuid.v4()
                    }
                });
            } catch (error) {
                const response = {
                    code: 401,
                    description: 'The merchantID specified in the request body is not linked to this voucher. ',
                    reasonPhrase: 'MerchantIDNotLinked'
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
        it('should validate missing salesPersonCode if sales person code is required', async () => {
            try {
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        fixedAmount: 30,
                        currency: sampleVoucher.currency
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
        it('should update fixedAmount if all the validations pass', async () => {

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

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
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

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(5.50);
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should not update voucher if redemptionLeft is less than spend', async () => {
            try {
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        currency: sampleVoucher.currency,
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
        it('should set isRedeemed to true if all validations pass', async () => {

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

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    fixedAmount: 20
                }
            });
            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should update vouchers if settlementList section have no field', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    settlementList: {
                        settleValueOnRedemption: 'redeemedvalue'
                    },
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

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    fixedAmount: 20
                }
            });
            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should update vouchers if settlementList section not exist', async () => {
            const settlementList = sampleVoucher.settlementList;
            delete sampleVoucher.settlementList;
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
            sampleVoucher.settlementList = settlementList;
            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
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
            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            // Remove sample document
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should update validFrom and validTo when redemption counter change from 0 to > 0', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {
                        validFromDate: moment.utc().toDate(),
                        validToDate: moment.utc().add(3, 'd')
                            .toDate(),
                        validDaysAfterFirstRedemption: 10
                    },
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

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 25
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const voucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            expect(voucher).not.to.be.null;
            expect(voucher.validPeriod).not.to.be.null;
            expect(voucher.validPeriod.validFromDate).not.to.be.null;
            expect(voucher.validPeriod.validToDate).not.to.be.null;
            var updatedDateValidFrom = new Date(voucher.validPeriod.validFromDate);
            const currentDate = new Date();
            expect(updatedDateValidFrom.getDate()).to.equal(currentDate.getDate());

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
        it('should update when redemptionsLeft and spend fields are not in voucher', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    redemptionRules: {},
                    redemptionCounter: 0,
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'monetary'
                    },
                    settlementList: {
                        ...sampleVoucher.settlementList,
                        settleFullAmountOnFirstRedemption: true,
                        totalSettlementAmountLeft: 26,
                        settlementAmountPerRedemption: 18.69,
                        settleValueOnRedemption: 'redeemedvalue'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 24
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.event).to.equal('redemption');
            const settlementList = updatedVoucher.settlementList;
            expect(updatedVoucher).not.to.be.null;
            expect(updatedVoucher.voucherValue).not.to.be.null;
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(1.5);
            expect(settlementList.totalSettlementAmountLeft).to.equal(2);
            let count = 0;
            if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                settlementList.settlementTransactions.forEach(element => {

                    if (element.merchantType === 'collector' && element.settlementAmount === 24) {
                        element.settlementAmount - (element.settlementAmount / ((element.vatPercent / 100) + 1));
                        count++;
                    }
                });
            }
            if (settlementList.settlementTransactions.length > 0) {
                expect(count).not.equal(0);
            }

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });


        describe('Settlement Transactions', () => {
            it('should set settlementAmount as totalSettlementAmountLeft', async () => {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        isMultiFunctionVoucher: true,
                        voucherValue: {
                            fixedAmount: 25.50,
                            valueType: 'monetary',
                            redemptionsLeft: 1,
                            spend: 1,
                            currency: 'SEK'
                        },
                        settlementList: {
                            ...sampleVoucher.settlementList,
                            settleFullAmountOnFirstRedemption: true,
                            totalSettlementAmountLeft: 12.67,
                            settleValueOnRedemption: 'fullonfirstredemption',
                            totalSettlementAmount: 50
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        currency: sampleVoucher.currency,
                        fixedAmount: 25

                    }
                });

                const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
                const updatedVoucher = await request.get(voucherUrl, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
                const settlementList = updatedVoucher.settlementList;

                let count = 0;
                if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                    settlementList.settlementTransactions.forEach(element => {

                        if (element.merchantType === 'collector' && element.settlementAmount === 50) {
                            count++;
                        }
                    });
                }
                if (settlementList.settlementTransactions.length > 0) {
                    expect(count).not.equal(0);
                }


                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            });
            it('should difference totalSettlementAmount from settlementAmountPerRedemption', async () => {

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
                        },
                        settlementList: {
                            ...sampleVoucher.settlementList,
                            settleFullAmountOnFirstRedemption: false,
                            totalSettlementAmountLeft: 12.67,
                            settlementAmountPerRedemption: 3.56
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        currency: sampleVoucher.currency,
                        fixedAmount: 25
                    }
                });

                const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
                const updatedVoucher = await request.get(voucherUrl, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                const settlementList = updatedVoucher.settlementList;

                expect(settlementList.totalSettlementAmountLeft).to.equal(9.11);

                let count = 0;
                if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                    settlementList.settlementTransactions.forEach(element => {

                        if (element.merchantType === 'collector' && element.settlementAmount === 3.56) {
                            count++;
                        }
                    });
                }
                if (settlementList.settlementTransactions.length > 0) {
                    expect(count).not.equal(0);
                }


                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            });
            it('should set settlementAmount as totalSettlementAmountLeft when settlementAmountPerRedemption is greater then totalSettlementAmountLeft', async () => {

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
                        },
                        settlementList: {
                            ...sampleVoucher.settlementList,
                            settleFullAmountOnFirstRedemption: true,
                            totalSettlementAmountLeft: 12.67,
                            settlementAmountPerRedemption: 18.69
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        currency: sampleVoucher.currency,
                        fixedAmount: 25
                    }
                });

                const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
                const updatedVoucher = await request.get(voucherUrl, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                const settlementList = updatedVoucher.settlementList;

                expect(settlementList.totalSettlementAmountLeft).to.equal(0);


                let count = 0;
                if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                    settlementList.settlementTransactions.forEach(element => {

                        if (element.merchantType === 'collector' && element.settlementAmount === 12.67) {
                            count++;
                        }
                    });
                }
                if (settlementList.settlementTransactions.length > 0) {
                    expect(count).not.equal(0);
                }

                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            });
            it('should set settlementAmount=0 settlement when when there is no money left', async () => {

                const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        redemptionRules: {},
                        voucherValue: {
                            fixedAmount: 25.50,
                            currency: 'SEK',
                            valueType: 'monetary',
                            redemptionsLeft: 1,
                            spend: 1
                        },
                        settlementList: {
                            ...sampleVoucher.settlementList,
                            settleFullAmountOnFirstRedemption: true,
                            totalSettlementAmountLeft: 0,
                            settlementAmountPerRedemption: 18.69
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        salesPersonCode: '12345',
                        merchantID: merchantID,
                        currency: sampleVoucher.currency,
                        fixedAmount: 25
                    }
                });

                const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
                const updatedVoucher = await request.get(voucherUrl, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                const settlementList = updatedVoucher.settlementList;

                expect(settlementList.totalSettlementAmountLeft).to.equal(0);

                let count = 0;
                if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                    settlementList.settlementTransactions.forEach(element => {

                        if (element.merchantType === 'collector' && element.settlementAmount === 0) {
                            count++;
                        }
                    });
                }
                if (settlementList.settlementTransactions.length > 0) {
                    expect(count).not.equal(0);
                }


                await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });
            });
        });

        it('should update all values when all validations pass', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    redemptionRules: {},
                    redemptionCounter: 0,
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'monetary',
                        redemptionsLeft: 1,
                        spend: 1
                    },
                    settlementList: {
                        ...sampleVoucher.settlementList,
                        settleFullAmountOnFirstRedemption: true,
                        totalSettlementAmountLeft: 26,
                        settlementAmountPerRedemption: 18.69,
                        settleValueOnRedemption: 'redeemedvalue'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 24
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.event).to.equal('redemption');
            const settlementList = updatedVoucher.settlementList;
            expect(updatedVoucher).not.to.be.null;
            expect(updatedVoucher.voucherValue).not.to.be.null;
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(1.5);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);
            expect(settlementList.totalSettlementAmountLeft).to.equal(2);
            let count = 0;
            if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                settlementList.settlementTransactions.forEach(element => {

                    if (element.merchantType === 'collector' && element.settlementAmount === 24) {
                        element.settlementAmount - (element.settlementAmount / ((element.vatPercent / 100) + 1));
                        count++;
                    }
                });
            }
            if (settlementList.settlementTransactions.length > 0) {
                expect(count).not.equal(0);
            }

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
    });

    describe('Discount voucher', () => {
        it('should not update voucher if redemptionLeft is less than spend', async () => {
            try {

                await request.post(helpers.API_URL + '/api/v1/vouchers', {
                    body: {
                        ...sampleVoucher,
                        isRedeemed: false,
                        validPeriod: {},
                        voucherValue: {
                            fixedAmount: 25.50,
                            valueType: 'discount',
                            redemptionsLeft: 0,
                            spend: 1
                        }
                    },
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    }
                });

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
                await request.put(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.X_FUNCTIONS_KEY
                    },
                    body: {
                        fixedAmount: 20,
                        currency: 'SEK',
                        redemptionsCount: 1,
                        salesPersonCode: '12345',
                        merchantID: merchantID
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

        it('should set isRedeemed to true if all validations pass', async () => {
            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'discount',
                        redemptionsLeft: 1,
                        settleValueOnRedemption: 'fullonfirstredemption',
                        spend: 1
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    fixedAmount: 25,
                    currency: 'SEK',
                    salesPersonCode: '12345',
                    merchantID: merchantID
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });

        it('should update all values when all validations pass', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    redemptionRules: {},
                    redemptionCounter: 0,
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'discount',
                        redemptionsLeft: 1,
                        spend: 1
                    },
                    settlementList: {
                        ...sampleVoucher.settlementList,
                        settleFullAmountOnFirstRedemption: true,
                        totalSettlementAmountLeft: 26,
                        settlementAmountPerRedemption: 18.69,
                        settleValueOnRedemption: 'redeemedvalue'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 24
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.event).to.equal('redemption');
            const settlementList = updatedVoucher.settlementList;
            expect(updatedVoucher).not.to.be.null;
            expect(updatedVoucher.voucherValue).not.to.be.null;
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(25.5);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);
            expect(settlementList.totalSettlementAmountLeft).to.equal(2);
            let count = 0;
            if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                settlementList.settlementTransactions.forEach(element => {

                    if (element.merchantType === 'collector' && element.settlementAmount === 24) {
                        element.settlementAmount - (element.settlementAmount / ((element.vatPercent / 100) + 1));
                        count++;
                    }
                });
            }
            if (settlementList.settlementTransactions.length > 0) {
                expect(count).not.equal(0);
            }

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });
    });

    describe('Exchange voucher', () => {
        it('should not update voucher if redemptionLeft is less than spend', async () => {
            try {
                await request.post(helpers.API_URL + '/api/v1/vouchers', {
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

                let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
                url += `&linkedID=${sampleVoucherLink.linkedID}`;
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

        it('should set isRedeemed to true if all validations pass', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'exchange',
                        redemptionsLeft: 1,
                        spend: 1,
                        settleValueOnRedemption: 'fullonfirstredemption'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            const redeemResult = await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    fixedAmount: 25,
                    currency: 'SEK',
                    salesPersonCode: '12345',
                    merchantID: merchantID
                }
            });
            expect(redeemResult).to.eql({
                description: 'Successfully redeemed the voucher'
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);
            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });

        it('should allow case insensitive passToken match', async () => {
            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    voucherValue: {
                        fixedAmount: 25.50,
                        valueType: 'exchange',
                        redemptionsLeft: 1,
                        spend: 1,
                        settleValueOnRedemption: 'fullonfirstredemption'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            const passToken = testVoucher.passToken.toUpperCase();
            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    fixedAmount: 25,
                    currency: 'SEK',
                    salesPersonCode: '12345',
                    merchantID: merchantID
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            expect(passToken).to.not.equal(updatedVoucher.passToken);

            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });

        it('should update all values when all validations pass', async () => {

            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    redemptionRules: {},
                    redemptionCounter: 0,
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'exchange',
                        redemptionsLeft: 1,
                        spend: 1
                    },
                    settlementList: {
                        ...sampleVoucher.settlementList,
                        settleFullAmountOnFirstRedemption: true,
                        totalSettlementAmountLeft: 26,
                        settlementAmountPerRedemption: 18.69,
                        settleValueOnRedemption: 'redeemedvalue'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    merchantID: merchantID,
                    currency: sampleVoucher.currency,
                    fixedAmount: 24
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.event).to.equal('redemption');
            const settlementList = updatedVoucher.settlementList;
            expect(updatedVoucher).not.to.be.null;
            expect(updatedVoucher.voucherValue).not.to.be.null;
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(25.5);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);
            expect(settlementList.totalSettlementAmountLeft).to.equal(2);
            let count = 0;
            if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                settlementList.settlementTransactions.forEach(element => {

                    if (element.merchantType === 'collector' && element.settlementAmount === 24) {
                        element.settlementAmount - (element.settlementAmount / ((element.vatPercent / 100) + 1));
                        count++;
                    }
                });
            }
            if (settlementList.settlementTransactions.length > 0) {
                expect(count).not.equal(0);
            }

            await request.delete(helpers.API_URL + '/api/v1/vouchers/' + sampleVoucher._id, {
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        });

        it('should update all values when merchantPartner exist.', async () => {

            const collection = await getMongodbCollection('Vouchers');
            sampleMerchantPartnerNetworks.partnerNetworkMemberships = [{
                partnerNetworkID: partnerNetworkID,
                partnerNetworkName: 'Network 1',
                roles: 'admin'
            }];
            await collection.insertOne(sampleMerchantPartnerNetworks);
            sampleVoucher.collectorLimitationsMerchants[0].merchantID = merchantID;
            sampleVoucher.collectorLimitationsPartnerNetworks = [{
                partnerNetworkID: partnerNetworkID,
                partnerNetworkName: 'Seven Eleven 123'
            }];
            const testVoucher = await request.post(helpers.API_URL + '/api/v1/vouchers', {
                body: {
                    ...sampleVoucher,
                    isRedeemed: false,
                    validPeriod: {},
                    redemptionRules: {},
                    redemptionCounter: 0,
                    voucherValue: {
                        fixedAmount: 25.50,
                        currency: 'SEK',
                        valueType: 'exchange',
                        redemptionsLeft: 1,
                        spend: 1
                    },
                    settlementList: {
                        ...sampleVoucher.settlementList,
                        settleFullAmountOnFirstRedemption: true,
                        totalSettlementAmountLeft: 26,
                        settlementAmountPerRedemption: 18.69,
                        settleValueOnRedemption: 'redeemedvalue'
                    }
                },
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });

            let url = `${helpers.API_URL}/api/v1/vouchers/redeem-voucher-pos-by-voucher-link?partnerNetworkID=${sampleVoucherLink.partitionKey}`;
            url += `&linkedID=${sampleVoucherLink.linkedID}`;
            await request.put(url, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                },
                body: {
                    salesPersonCode: '12345',
                    currency: sampleVoucher.currency,
                    fixedAmount: 24,
                    merchantID: sampleVoucher.collectorLimitationsMerchants[0].merchantID,
                }
            });

            const voucherUrl = `${helpers.API_URL}/api/v1/vouchers/${testVoucher._id}`;
            const updatedVoucher = await request.get(voucherUrl, {
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
            expect(updatedVoucher.redemptionCounter).to.equal(1);
            expect(updatedVoucher.isRedeemed).to.equal(true);
            expect(updatedVoucher.event).to.equal('redemption');
            const settlementList = updatedVoucher.settlementList;
            expect(updatedVoucher).not.to.be.null;
            expect(updatedVoucher.voucherValue).not.to.be.null;
            expect(updatedVoucher.voucherValue.fixedAmount).to.equal(25.5);
            expect(updatedVoucher.voucherValue.redemptionsLeft).to.equal(0);
            expect(settlementList.totalSettlementAmountLeft).to.equal(2);
            let count = 0;
            if (settlementList && settlementList.settlementTransactions && Array.isArray(settlementList.settlementTransactions)) {
                settlementList.settlementTransactions.forEach(element => {

                    if (element.merchantType === 'collector' && element.settlementAmount === 24) {
                        element.settlementAmount - (element.settlementAmount / ((element.vatPercent / 100) + 1));
                        count++;
                    }
                });
            }
            if (settlementList.settlementTransactions.length > 0) {
                expect(count).not.equal(0);
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
        const collectionRegional = await getMongodbCollectionRegional('Merchants');
        const StatsResult1 = await collectionRegional.deleteMany({ merchantID: sampleVoucher.issuer.merchantID, docType: 'merchantstatisticsdaily', partitionKey: sampleVoucher.issuer.merchantID });
        const StatsResult2 = await collectionRegional.deleteMany({ merchantID: sampleVoucher.issuer.merchantID, docType: 'merchantstatisticsmonthly', partitionKey: sampleVoucher.issuer.merchantID });
        console.log(StatsResult1.deletedCount);
        console.log(StatsResult2.deletedCount);
        const result = await collection.deleteMany({ voucherID: sampleVoucher._id, docType: 'voucherLog', partitionKey: sampleVoucher._id });
        if (result.deletedCount === 0) {
            throw 'voucherLog not deleted';
        }
        console.log(result.deletedCount);
        await deleteBlob();
        console.log('blobs doc deleted');
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