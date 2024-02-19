'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = async (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to update a partnerNetworkMember but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection = false;
    let partnerNetworkDoc;
    return utils
        .validateUUIDField(context, req.params.partnerNetworkID, 'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return collection.findOne({
                _id: req.params.partnerNetworkID,
                docType: 'partnerNetworks',
                partitionKey: req.params.partnerNetworkID
            });
        })
        .then(async partnerNetwork =>{
            if (partnerNetwork) {
                partnerNetworkDoc = partnerNetwork;
                let isAbleToUpdate = false;
                let updatedMerchant;
                if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.body.requestedMerchantID && element.roles === 'admin') {
                            isAbleToUpdate = true;
                        }
                        if (element.merchantID === req.body.merchantID) {
                            updatedMerchant = element;
                        }
                    });
                }
                if (isAbleToUpdate) {
                    if (updatedMerchant) {
                        const partnerNetworkMembers = {
                            merchantID: updatedMerchant.merchantID,
                            merchantName: updatedMerchant.merchantName,
                            currency: updatedMerchant.currency
                        };
                        if (req.body.commissionAmount) {
                            partnerNetworkMembers.commissionAmount = req.body.commissionAmount;
                        } else {
                            partnerNetworkMembers.commissionAmount = updatedMerchant.commissionAmount;
                        }
                        if (req.body.commissionPercent) {
                            partnerNetworkMembers.commissionPercent = req.body.commissionPercent;
                        } else {
                            partnerNetworkMembers.commissionPercent = updatedMerchant.commissionPercent;
                        }
                        if (req.body.feeMonthlyMembershipAmount) {
                            partnerNetworkMembers.feeMonthlyMembershipAmount = req.body.feeMonthlyMembershipAmount;
                        } else {
                            partnerNetworkMembers.feeMonthlyMembershipAmount = updatedMerchant.feeMonthlyMembershipAmount;
                        }
                        if (req.body.currency) {
                            partnerNetworkMembers.currency = req.body.currency;
                        } else {
                            partnerNetworkMembers.currency = updatedMerchant.currency;
                        }
                        if (req.body.roles) {
                            partnerNetworkMembers.roles = req.body.roles;
                        } else {
                            partnerNetworkMembers.roles = updatedMerchant.roles;
                        }
                        const updatedResult = new Array();
                        updatedResult.push(await voucherCollection.updateOne({
                            _id: req.params.partnerNetworkID,
                            docType: 'partnerNetworks',
                            partitionKey: req.params.partnerNetworkID
                        }, {
                            $pull: { partnerNetworkMembers: { merchantID: req.body.merchantID }}
                        }));
                        updatedResult.push(await voucherCollection.updateOne({
                            _id: req.params.partnerNetworkID,
                            docType: 'partnerNetworks',
                            partitionKey: req.params.partnerNetworkID
                        }, {
                            $push: { partnerNetworkMembers: partnerNetworkMembers }
                        }));
                        return updatedResult;
                    } else {
                        utils.setContextResError(
                            context,
                            new errors.PartnerNetworkMembersNotFound(
                                'The given partner network members not available in this partner network to be updated.',
                                404
                            )
                        );
                    }
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant not able to update the partner network.',
                            401
                        )
                    );
                }
            } else {
                utils.setContextResError(
                    context,
                    new errors.PartnerNetworkNotFoundError(
                        'The partnerNetwork of specified details in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .then(async result => {
            if (result && Array.isArray(result) && result.length) {
                if (result[0].matchedCount && result[1].matchedCount) {
                    const allResult = [];
                    if (req.body.roles) {
                        allResult.push(await voucherCollection.updateOne({
                            merchantID: req.body.merchantID,
                            docType: 'merchantPartnerNetworks',
                            partitionKey: req.body.merchantID
                        },{
                            $pull: { partnerNetworkMemberships: { partnerNetworkID: req.params.partnerNetworkID }}
                        }));
                        allResult.push(await voucherCollection.updateOne({
                            merchantID: req.body.merchantID,
                            docType: 'merchantPartnerNetworks',
                            partitionKey: req.body.merchantID
                        },{
                            $push: { partnerNetworkMemberships: { partnerNetworkID: req.params.partnerNetworkID,
                                partnerNetworkName: partnerNetworkDoc.partnerNetworkName,
                                roles: req.body.roles }}
                        }));
                        return allResult;
                    } else {
                        return true;
                    }
                }
            }
        })
        .then(result =>{
            if (req.body.roles) {
                if (result && Array.isArray(result) && result.length) {
                    if (result[0].matchedCount && result[1].matchedCount) {
                        context.res = {
                            body: {
                                code: 200,
                                description: 'Successfully updated the document'
                            }
                        };
                    }
                }
            } else if (result) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully updated the document'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
