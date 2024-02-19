'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');
const moment = require('moment');
const uuid = require('uuid');
const request = require('request-promise');

module.exports = async (context, req) => {
    let merchantDoc;
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to invite a partnerNetwork but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection, partnerNetworkDoc, merchantDetails;
    let isAbleToSendInvitation = false, isError = false;
    const inviteExpiryDate = moment.utc().add(60, 'd')
        .startOf('day')
        .toDate();
    return utils
        .validateUUIDField(context, req.body.partnerNetworkID, 'The id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return request.get(`${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${req.body.merchantID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.MERCHANTS_API_KEY
                }
            });
        })
        .then(merchant =>{
            if (merchant) {
                merchantDoc = merchant;
            }
            return voucherCollection.findOne({
                _id: req.body.partnerNetworkID,
                docType: 'partnerNetworks',
                partitionKey: req.body.partnerNetworkID
            });
        })
        .then(partnerNetwork => {
            if (partnerNetwork && partnerNetwork.partnerNetworkMembers) {
                partnerNetworkDoc = partnerNetwork;
                partnerNetwork.partnerNetworkMembers.forEach(element => {
                    if (element.merchantID === req.body.invitedMerchantID && element.roles === 'admin') {
                        isAbleToSendInvitation = true;
                        merchantDetails = element;
                    }
                });
                if (isAbleToSendInvitation) {
                    if (!partnerNetwork.partnerNetworkInvites || Array.isArray(!partnerNetwork.partnerNetworkInvites)) {
                        partnerNetwork.partnerNetworkInvites = new Array();
                    }
                    partnerNetwork.partnerNetworkInvites.forEach(element => {
                        if (element.merchantID === req.body.merchantID) {
                            isError = true;
                        }
                    });
                    if (isError) {
                        return utils.setContextResError(
                            context,
                            new errors.MerchantAlreadyInvited(
                                'This Merchant already invited.',
                                401
                            )
                        );
                    }
                    const partnerNetworkInvites = {
                        merchantID: req.body.merchantID,
                        merchantName: merchantDoc.merchantName,
                        merchantInviteSentFrom: merchantDetails.merchantName,
                        roles: req.body.roles,
                        inviteExpiryDate: inviteExpiryDate
                    };
                    return voucherCollection.updateOne({
                        _id: req.body.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.body.partnerNetworkID
                    },
                    {
                        $push: { partnerNetworkInvites: partnerNetworkInvites }
                    });
                } else {
                    isError = true;
                    utils.setContextResError(
                        context,
                        new errors.NotAuthenticatedError(
                            'The given merchant not allowed to perform this section.',
                            401
                        )
                    );
                }
            } else {
                isError = true;
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
            if (result && result.matchedCount && !isError) {
                const partnerNetworkInvites = {
                    partnerNetworkID: partnerNetworkDoc._id,
                    partnerNetworkName: partnerNetworkDoc.partnerNetworkName,
                    roles: req.body.roles,
                    inviteExpiryDate: inviteExpiryDate
                };
                const query = {
                    merchantID: req.body.merchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.body.merchantID
                };
                const update = {
                    $push: {
                        partnerNetworkInvites: partnerNetworkInvites
                    },
                    $setOnInsert: {
                        _id: uuid.v4(),
                        docType: 'merchantPartnerNetworks',
                        partitionKey: req.body.merchantID,
                        merchantID: req.body.merchantID,
                        merchantName: merchantDoc.merchantName,
                        createdDate: new Date()
                    },
                    $set: {
                        updatedDate: new Date()
                    }
                };

                const options = {
                    upsert: true
                };

                return voucherCollection.updateOne(query, update, options);

            }
        })
        .then(result =>{
            if (result && !isError) {
                if (result.upsertedCount || result.matchedCount) {
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Successfully invited the partnerNetwork'
                        }
                    };
                }
            }
        })
        .catch(error => utils.handleError(context, error));
};
