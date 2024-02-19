'use strict';
const request = require('request-promise');
const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');
const moment = require('moment');
const { CustomLogs } = utils;
const redemptionUtils = require('../utils/redemptionUtils');

//This endpoint use for the redeem a voucher, Please refer the bac-169,218,242,258, 276, 295(Redemption notification message update),317, 349, 351 for further details

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to redeem a voucher but the request body seems to be empty. Kindly specify the voucher properties to be redeemded using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }

    CustomLogs(req.body, context);

    if (!req.query.passToken) {
        utils.setContextResError(
            context,
            new errors.MissingPassTokenError(
                'Field passToken is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }

    if (!req.query.voucherToken) {
        utils.setContextResError(
            context,
            new errors.MissingVoucherTokenError(
                'Field voucherToken is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }

    let id, redemption, key, settlementTransaction, redemptionCodeHashed, balanceAccountID, collection,
        partnerNetwork, merchant, voucher, voucherValue, voucherBalanceAmount, updatedVoucher, redemptionCost;
    let isMerchantLinked = false;

    return utils
        .validateUUIDField(context, req.query.voucherToken, 'The voucherToken specified in the URL does not match UUID v4 format.')
        .then(() => {
            return getMongodbCollection('Vouchers');
        })
        .then(voucherCollection => {
            collection = voucherCollection;
            return collection.findOne({
                voucherToken: req.query.voucherToken,
                passToken: req.query.passToken.toLowerCase(),
                partitionKey: req.query.passToken.toLowerCase(),
                docType: 'vouchers'
            });
        })
        .then(voucherDoc => {
            voucher = voucherDoc;
            if (!voucher) {
                return Promise.reject(
                    new errors.VoucherNotFoundError(
                        'We could not find a voucher matching the specified voucherToken and passToken.' +
                        ' Kindly verify the tokens and try again.',
                        404
                    )
                );
            }
            id = voucher._id;
            key = voucher.partitionKey;
            if (voucher.isRedeemed) {
                return Promise.reject(
                    new errors.VoucherRedeemdedError(
                        'The voucher you\'ve requested to redeem has already been redeemed',
                        400
                    )
                );
            }

            if (voucher.isCanceled) {
                return Promise.reject(
                    new errors.VoucherRedeemdedError(
                        'The voucher you\'ve requested to redeem has canceled',
                        400
                    )
                );
            }

            if (voucher.isExpired) {
                return Promise.reject(
                    new errors.VoucherExpiredError(
                        'The voucher you\'ve requested to redeem has expired.',
                        400
                    )
                );
            }

            if (voucher.isLocked) {
                return Promise.reject(
                    new errors.VoucherLockedError(
                        'Voucher is locked. Ask customer to unlock it before it can be redeemed',
                        400
                    )
                );
            }

            if (req.body.currency) {
                if (voucher.currency !== req.body.currency) {
                    return Promise.reject(
                        new errors.VoucherCurrencyMismatchError(
                            'The currency specified in the request body does not match the voucher currency.',
                            401
                        )
                    );
                }
            }

            const validPeriod = voucher.validPeriod;

            if (validPeriod.validFromDate && validPeriod.validToDate) {
                const hasExpired = !moment
                    .utc()
                    .isBetween(validPeriod.validFromDate, validPeriod.validToDate);

                if (hasExpired) {
                    return Promise.reject(
                        new errors.VoucherExpiredError(
                            'The voucher you\'ve requested to redeem has expired.',
                            400
                        )
                    );
                }
            }

            if (validPeriod.validDaysOfWeek) {
                const currentUtcWeekDay = moment.utc().format('dd');
                if (!validPeriod.validDaysOfWeek.includes(currentUtcWeekDay)) {
                    return Promise.reject(
                        new errors.VoucherValidWeekdaysError(
                            `The voucher you've requested to redeem can only be redeemded on ${utils.expandWeekdayCodes(validPeriod.validDaysOfWeek)}`,
                            400
                        )
                    );
                }
            }

            if (validPeriod.validFromTime && validPeriod.validToTime) {
                const validFrom = moment.utc(validPeriod.validFromTime, 'HH:mm:ss');
                const validTo = moment.utc(validPeriod.validToTime, 'HH:mm:ss');

                const isValid = moment
                    .utc()
                    .isBetween(validFrom, validTo);

                if (!isValid) {
                    return Promise.reject(
                        new errors.VoucherValidTimeError(
                            `This voucher you've requested to redeem is only valid for redemption between ${validPeriod.validFromTime} to ${validPeriod.validToTime}`,
                            400
                        )
                    );
                }
            }

            if (!voucher.voucherValue) {
                return Promise.reject(
                    new errors.FieldValidationError(
                        'Field voucherValue is missing in voucher doc.',
                        400
                    )
                );
            }
            voucherValue = voucher.voucherValue;

            if (voucherValue.redemptionsLeft < 0) {
                return Promise.reject(
                    new errors.NoRedemptionsLeftError(
                        'The voucher you have requested to redeem has no redemptions left.',
                        400
                    )
                );
            }

            const redemptionRules = voucher.redemptionRules;

            if (redemptionRules && redemptionRules.redemptionCodeIsRequired) {
                if (!req.body.redemptionCode) {
                    return Promise.reject(
                        new errors.MissingRedemptionCodeError(
                            'Field redemptionCode is missing from request body.',
                            400
                        )
                    );
                }

                redemptionCodeHashed = utils.hashToken(req.body.redemptionCode);
                if (
                    redemptionRules.redemptionCodes &&
                    Array.isArray(redemptionRules.redemptionCodes) &&
                    !redemptionRules.redemptionCodes.includes(redemptionCodeHashed)
                ) {
                    return Promise.reject(
                        new errors.IncorrectRedemptionCodeError(
                            'The redemptionCode specified in the request body is incorrect. Kindly verify the redemptionCode and try again.',
                            403
                        )
                    );
                }
            }
            let merchantID;
            const collectorLimitationsMerchants = voucher.collectorLimitationsMerchants;
            if (req.body.merchantID) {
                merchantID = req.body.merchantID;
                if (collectorLimitationsMerchants && Array.isArray(collectorLimitationsMerchants)) {
                    collectorLimitationsMerchants.forEach(element => {
                        if (element.merchantID && element.merchantID === req.body.merchantID) {
                            balanceAccountID = element.balanceAccountID;
                            isMerchantLinked = true;
                        }
                    });
                }
            } else {
                merchantID = voucher.issuer.merchantID;
                if (collectorLimitationsMerchants && Array.isArray(collectorLimitationsMerchants)) {
                    collectorLimitationsMerchants.forEach(element => {
                        if (element.merchantID && voucher.issuer && element.merchantID === voucher.issuer.merchantID) {
                            isMerchantLinked = true;
                        }
                    });
                }
            }

            if (redemptionRules && redemptionRules.salesPersonCodeIsRequired) {
                if (!req.body.salesPersonCode) {
                    return Promise.reject(
                        new errors.MissingSalesPersonCodeError(
                            'Field salesPersonCode is missing from request body.',
                            400
                        )
                    );
                }
            }

            if (!isMerchantLinked) {
                return collection.findOne({
                    merchantID: merchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: merchantID
                });
            }

            
        })
        .then(merchantPartnerNetworks =>{
            if (merchantPartnerNetworks && merchantPartnerNetworks.partnerNetworkMemberships) {
                const collectorLimitationsPartnerNetworks = new Array();
                if (voucher.collectorLimitationsPartnerNetworks && Array.isArray(voucher.collectorLimitationsPartnerNetworks)) {
                    voucher.collectorLimitationsPartnerNetworks.forEach(element => {
                        collectorLimitationsPartnerNetworks.push(element.partnerNetworkID);
                    });

                    merchantPartnerNetworks.partnerNetworkMemberships.forEach(element => {
                        if (collectorLimitationsPartnerNetworks.includes(element.partnerNetworkID)) {
                            isMerchantLinked = true;
                            partnerNetwork = element;
                        }
                    });
                }
            }
            
            if (!isMerchantLinked) {
                return Promise.reject(
                    new errors.MerchantIDNotLinked(
                        'The merchantID is not linked to this voucher.',
                        401
                    )
                );
            }

            const settlementList = voucher.settlementList;

            if (settlementList && settlementList.settleValueOnRedemption) {
                if (settlementList.settleValueOnRedemption === 'fullonfirstredemption') {
                    if (!voucher.redemptionCounter) { // for both zero and undefined
                        if (voucher.settlementList.totalSettlementAmount) {
                            redemptionCost = voucher.settlementList.totalSettlementAmount;
                        } else {
                            redemptionCost = 0;
                        }
                    } else if (voucher.redemptionCounter > 0) {
                        redemptionCost = 0;
                    }
                }
                if (settlementList.settleValueOnRedemption === 'redeemedvalue') {
                    if (req.body.fixedAmount) {
                        redemptionCost = req.body.fixedAmount;
                    }
                    if (!req.body.fixedAmount) {
                        if (voucherValue.valueType === 'exchange' || voucherValue.valueType === 'discount') {
                            redemptionCost = settlementList.totalSettlementAmountLeft;
                        } else {
                            return Promise.reject(
                                new errors.MissingFixedAmountError(
                                    'Field fixedAmount is missing from request body.',
                                    400
                                )
                            );
                        }
                    }
                }
                if (settlementList.settleValueOnRedemption === 'evensplit') {
                    if (voucher.settlementList.totalSettlementAmount && voucher.voucherValue.redemptionsTotal && voucher.settlementList.totalSettlementAmountLeft > 0) {
                        redemptionCost = (voucher.settlementList.totalSettlementAmount / voucher.voucherValue.redemptionsTotal);
                    } else {
                        redemptionCost = 0;
                    }
                }

                if (settlementList.settleValueOnRedemption === 'fixedamount') {
                    if (voucher.settlementList.settlementAmountPerRedemption) {
                        redemptionCost = voucher.settlementList.settlementAmountPerRedemption;
                    } else {
                        redemptionCost = 0;
                    }
                }

                if (settlementList.settleValueOnRedemption === 'perunit') {
                    if (!req.body.fixedAmount) {
                        return Promise.reject(
                            new errors.MissingFixedAmountError(
                                'Field fixedAmount is missing from request body.',
                                400
                            )
                        );
                    }
                    if (voucher.settlementList.settlementAmountPerUnit) {
                        redemptionCost = Number(Number(req.body.fixedAmount * voucher.settlementList.settlementAmountPerUnit).toFixed(2));
                    } else {
                        redemptionCost = 0;
                    }
                }

                if (settlementList.settleValueOnRedemption !== 'fixedamount' && settlementList.settleValueOnRedemption !== 'evensplit' &&
                    settlementList.settleValueOnRedemption !== 'redeemedvalue' && settlementList.settleValueOnRedemption !== 'fullonfirstredemption'
                    && settlementList.settleValueOnRedemption !== 'perunit') {
                    return Promise.reject(
                        new errors.FieldValidationError(
                            'Field settleValueOnRedemption in settlementList section is not set one of these values fixedamount, evensplit, redeemedvalue or fullonfirstredemption  in voucher doc.',
                            400
                        )
                    );
                }
            } else {
                redemptionCost = 0;
            }

            if (!voucher.redemptionCounter) { // for both zero and undefined
                if (voucher.validPeriod && voucher.validPeriod.validDaysAfterFirstRedemption) {
                    voucher.validPeriod.validToDate = moment.utc().add(voucher.validPeriod.validDaysAfterFirstRedemption, 'd')
                        .toDate();
                }
            }

            if (!voucher.balanceAccountID) {
                return Promise.reject(
                    new errors.MissingBalanceAccountIDError(
                        'Balance Account is missing in this Voucher. Please contact Vourity support.',
                        400
                    )
                );
            }

            return collection.findOne({
                _id: voucher.balanceAccountID,
                partitionKey: voucher.balanceAccountID,
                docType: 'balanceAccount'
            });
        })
        .then(balanceAccountDoc => {
            if (balanceAccountDoc && (balanceAccountDoc.balanceAccountType === 'cashcard' ||
                balanceAccountDoc.balanceAccountType === 'cashpool')) {
                if (balanceAccountDoc.balanceAmount) {
                    if (balanceAccountDoc.balanceAmount < 0 && balanceAccountDoc.creditLimit > 0) {
                        if (balanceAccountDoc.balanceAmount + balanceAccountDoc.creditLimit < 0) {
                            voucherBalanceAmount = 0;
                        } else {
                            voucherBalanceAmount = balanceAccountDoc.balanceAmount + balanceAccountDoc.creditLimit;
                        }
                    } else if (balanceAccountDoc.balanceAmount < 0 && balanceAccountDoc.creditLimit <= 0) {
                        voucherBalanceAmount = 0;
                    } else {
                        voucherBalanceAmount = balanceAccountDoc.balanceAmount;
                    }

                } else {
                    voucherBalanceAmount = 0;
                }

                if (voucherBalanceAmount < redemptionCost) {
                    return Promise.reject(
                        new errors.RedemptionCostError(
                            'The VoucherBalanceAmount less than RedemptionCost',
                            401
                        )
                    );
                }
            }
            if (req.body.merchantID) {
                return request.get(`${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${req.body.merchantID}`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.MERCHANTS_API_KEY
                    }
                });
            }
        })
        .catch(error => {
            if (error.error && (error.error.code === 404 && error.error.reasonPhrase === 'MerchantNotFoundError')) {
                return false;
            }
            throw error;
        })
        .then(merchantDoc => {
            if (merchantDoc) {
                merchant = merchantDoc;
            }
            if (voucherValue) {
                let isVoucherValueValid = false;
                if (voucherValue.valueType === 'monetary' || voucherValue.valueType === 'genericvalue') {

                    if (voucherValue.valueType === 'genericvalue' && voucher.settlementList.settleValueOnRedemption !== 'perunit') {
                        return Promise.reject(
                            new errors.IncorrectSettleValueOnRedemptionError(
                                'For genericvalue valueType of voucher settleValueOnRedemption of voucher has to be perunit',
                                400
                            )
                        );
                    }
                    isVoucherValueValid = true;
                    if (!req.body.fixedAmount) {
                        return Promise.reject(
                            new errors.MissingFixedAmountError(
                                'Field fixedAmount is missing from request body.',
                                400
                            )
                        );
                    }

                    if (req.body.currency) {
                        if (voucherValue.currency !== req.body.currency) {
                            return Promise.reject(
                                new errors.VoucherCurrencyMismatchError(
                                    'The currency specified in the request body does not match the voucher currency.',
                                    400
                                )
                            );
                        }
                    }
                    const fixedAmount = Number(req.body.fixedAmount);

                    if (fixedAmount > voucherValue.fixedAmount) {
                        return Promise.reject(
                            new errors.RedemptionFixedAmountExceededError(
                                'The amount specified in the request body exceeds the value of the voucher.',
                                400
                            )
                        );
                    }
                    voucherValue.fixedAmount = voucherValue.fixedAmount - fixedAmount;

                    try {
                        const isRedeemed = redemptionUtils.getRedemptionFields(
                            voucherValue,
                            req.body.redemptionsCount
                        );
                        return redemptionUtils.updateVoucher(voucher, isRedeemed, voucherValue, collection, merchant, balanceAccountID, redemptionCost, partnerNetwork);

                    } catch (error) {
                        return Promise.reject(error);
                    }
                }

                if (voucherValue.valueType === 'discount' || voucherValue.valueType === 'exchange') {
                    isVoucherValueValid = true;
                    try {
                        const isRedeemed = redemptionUtils.getRedemptionFields(
                            voucherValue,
                            req.body.redemptionsCount
                        );

                        return redemptionUtils.updateVoucher(voucher, isRedeemed, voucherValue, collection, merchant, balanceAccountID, redemptionCost, partnerNetwork);

                    } catch (error) {
                        return Promise.reject(error);
                    }
                }

                if (!isVoucherValueValid) {
                    return Promise.reject(
                        new errors.VoucherRedeemdedError(
                            'Voucher with the specified valueType is Invalid',
                            400
                        )
                    );
                }
            }

        })
        .then(updateResult => {
            if (updateResult && updateResult[1].matchedCount) {
                settlementTransaction = updateResult[0];
                voucher._id = id;
                voucher.partitionKey = key;
                return voucher;
            }
        })
        .then(updateResult => {
            if (updateResult) {
                context.log(updateResult);
                updatedVoucher = updateResult;
                try {
                    utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, updatedVoucher);
                } catch (err) {
                    console.log(err);
                }
                // Create Redemption Record
                const redemptionDoc = redemptionUtils
                    .buildRedemptionRecord(updateResult, req.body, settlementTransaction);

                return redemptionDoc;
            }
        })
        .then(result => {
            if (result) {
                redemption = result;
                try {
                    return utils.sendRedemptionMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_REDEMPTIONS, redemption);
                } catch (err) {
                    console.log(err);
                }
            }
        })
        .then(result => {
            if (result === false) {
                return collection.insertOne(redemption);
            } else if (result === true) {
                return true;
            }
        })
        .then((result) => {
            if (result) {
                context.res = {
                    body: {
                        description: 'Successfully redeemed the voucher'
                    }
                };
            }

        })
        .catch(error => {
            utils.handleError(context, error);
            if (voucher && error.code && error.name) {
                try {
                    const voucherLog = utils.voucherLog(voucher, merchant, error);
                    utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_ERRORS, voucherLog);
                    if (process.env.TRACK_REQUEST) {

                        utils.logInfo(error);
                    }
                } catch (err) {
                    console.log(err);
                }
            }
        });
};
