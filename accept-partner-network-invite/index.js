'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer the bac-346, 368, 393 for further details

module.exports = async (context, req) => {
    
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to accept partner network invite but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection, merchantDetails;
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
            if (partnerNetwork && partnerNetwork.partnerNetworkInvites) {
                partnerNetwork.partnerNetworkInvites.forEach(element => {
                    if (element.merchantID === req.body.merchantID) {
                        merchantDetails = element;
                    }
                });
                let partnerNetworkMembers;
                if (merchantDetails) {
                    partnerNetworkMembers = {
                        merchantID: req.body.merchantID,
                        merchantName: merchantDetails.merchantName,
                        roles: merchantDetails.roles
                    };
                } else {
                    return utils.setContextResError(
                        context,
                        new errors.partnerNetworkInvitesNotFound(
                            'The spacified merchant is not present in this partnerNetworkInvites of partner network.',
                            401
                        )
                    );
                }
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
                    $push: { partnerNetworkMembers: partnerNetworkMembers },
                    $pull: { partnerNetworkInvites: { merchantID: req.body.merchantID }}
                });
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
        .then(result => {
            if (result && result.matchedCount) {
                return voucherCollection.findOne({
                    merchantID: req.body.merchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.body.merchantID
                });
            }
        })
        .then(merchantPartnerNetworks => {
            if (merchantPartnerNetworks) {
                let partnerNetworkDetails;
                merchantPartnerNetworks.partnerNetworkInvites.forEach(element => {
                    if (element.partnerNetworkID === req.body.partnerNetworkID) {
                        partnerNetworkDetails = element;
                    }
                });
                const partnerNetworkMemberships = {};
                if (partnerNetworkDetails) {
                    partnerNetworkMemberships.partnerNetworkID = partnerNetworkDetails.partnerNetworkID;
                    partnerNetworkMemberships.partnerNetworkName = partnerNetworkDetails.partnerNetworkName;
                    partnerNetworkMemberships.roles = partnerNetworkDetails.roles;
                }
                return voucherCollection.updateOne({
                    merchantID: req.body.merchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.body.merchantID
                }, { $pull: { partnerNetworkInvites: { partnerNetworkID: req.body.partnerNetworkID }},
                    $push: { partnerNetworkMemberships: partnerNetworkMemberships }
                });
            }
        })
        .then(result => {
            if (result && result.modifiedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully accept partner network invite request'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
