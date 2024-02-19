'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');
const request = require('request-promise');

//Please refer the bac-346 for further details

module.exports = async (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to send a partnerNetworkMemberRequest but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection, merchantDoc;
    let isAlreadyRequested = false;
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
        .then(merchant => {
            if (merchant) {
                merchantDoc = merchant;
                return voucherCollection.findOne({
                    _id: req.body.partnerNetworkID,
                    docType: 'partnerNetworks',
                    partitionKey: req.body.partnerNetworkID
                });
            }
        })
        .then(partnerNetwork => {
            if (partnerNetwork) {
                if (!partnerNetwork.inviteCode || partnerNetwork.inviteCode !== req.body.inviteCode) {
                    return utils.setContextResError(
                        context,
                        new errors.FieldValidationError(
                            'The inviteCode is wrong.',
                            401
                        )
                    );
                }
               
                partnerNetwork.partnerNetworkRequests.forEach(element => {
                    if (element.merchantID === req.body.merchantID) {
                        isAlreadyRequested = true;
                    }
                });
                if (isAlreadyRequested) {
                    return utils.setContextResError(
                        context,
                        new errors.MemberAlreadyRequested(
                            'This Merchant already requested for member.',
                            401
                        )
                    );
                }
                const partnerNetworkRequests = {
                    merchantID: req.body.merchantID,
                    merchantName: merchantDoc.merchantName,
                    requestDate: new Date()
                };
                return voucherCollection.updateOne({
                    _id: req.body.partnerNetworkID,
                    docType: 'partnerNetworks',
                    partitionKey: req.body.partnerNetworkID,
                    inviteCode: req.body.inviteCode
                },
                {
                    $push: { partnerNetworkRequests: partnerNetworkRequests }
                });
            }
           
        })
        .then(result => {
            if (result && result.matchedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully send partner network request'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
