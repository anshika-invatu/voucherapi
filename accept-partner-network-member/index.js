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
                'You\'ve requested to accept partner network member but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection, merchantDetails, partnerNetworkDoc;
    let isAbleToAcceptNetworkMember = false, isAlreadyExist = false;
    return utils
        .validateUUIDField(context, req.body.partnerNetworkID, 'The id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return collection.findOne({
                _id: req.body.partnerNetworkID,
                docType: 'partnerNetworks',
                partitionKey: req.body.partnerNetworkID
            });
        })
        .then(partnerNetwork => {
            if (partnerNetwork && partnerNetwork.partnerNetworkMembers) {
                partnerNetworkDoc = partnerNetwork;
                partnerNetwork.partnerNetworkMembers.forEach(element => {
                    if (element.merchantID === req.body.requestedMerchantID && element.roles === 'admin') {
                        isAbleToAcceptNetworkMember = true;
                    }
                });
                partnerNetwork.partnerNetworkRequests.forEach(element => {
                    if (element.merchantID === req.body.merchantID) {
                        merchantDetails = element;
                    }
                });
                if (isAbleToAcceptNetworkMember) {
                    if (merchantDetails) {
                        const partnerNetworkMembers = {
                            merchantID: req.body.merchantID,
                            merchantName: merchantDetails.merchantName,
                            roles: req.body.roles
                        };
                        if (req.body.commissionAmount) {
                            partnerNetworkMembers.commissionAmount = req.body.commissionAmount;
                        }
                        if (req.body.commissionPercent) {
                            partnerNetworkMembers.commissionPercent = req.body.commissionPercent;
                        }
                        if (req.body.currency) {
                            partnerNetworkMembers.currency = req.body.currency;
                        }
                        return voucherCollection.updateOne({
                            _id: req.body.partnerNetworkID,
                            docType: 'partnerNetworks',
                            partitionKey: req.body.partnerNetworkID
                        },
                        {

                            $pull: { partnerNetworkRequests: { merchantID: req.body.merchantID }},
                            $push: { partnerNetworkMembers: partnerNetworkMembers }
                        });
                    } else {
                        return utils.setContextResError(
                            context,
                            new errors.MerchantNotMemberError(
                                'This merchant is not a available in partner network request.',
                                404
                            )
                        );
                    }
                } else {
                    utils.setContextResError(
                        context,
                        new errors.NotAuthenticatedError(
                            'The spacified merchant is not present in this partnerNetworkRequests of partner network.',
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
            if (result && result.modifiedCount) {
                const merchantPartnerNetwork = await voucherCollection.findOne({
                    merchantID: req.body.merchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.body.merchantID
                });
                if (merchantPartnerNetwork) {
                    if (merchantPartnerNetwork.partnerNetworkMemberships && Array.isArray(merchantPartnerNetwork.partnerNetworkMemberships)) {
                        merchantPartnerNetwork.partnerNetworkMemberships.forEach(element => {
                            if (element.partnerNetworkID === req.body.partnerNetworkID) {
                                isAlreadyExist = true;
                            }
                        });
                    }
                    if (isAlreadyExist) {
                        return isAlreadyExist;
                    } else {
                        return voucherCollection.updateOne({
                            merchantID: req.body.merchantID,
                            docType: 'merchantPartnerNetworks',
                            partitionKey: req.body.merchantID
                        },
                        {
                            $push: {
                                partnerNetworkMemberships: {
                                    partnerNetworkID: req.body.partnerNetworkID,
                                    partnerNetworkName: partnerNetworkDoc.partnerNetworkName,
                                    roles: req.body.roles
                                }
                            }
                        });
                    }
                }
            }
        })
        .then(result => {
            if ((result && result.modifiedCount) || isAlreadyExist) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully accept partner network member request'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
