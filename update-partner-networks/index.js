'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer the bac-346, 368, 379, 382 for further details

module.exports = async (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to update a partnerNetwork but the request body seems to be empty. Kindly pass the partnerNetwork fields to be updated using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let voucherCollection = false, partnerNetworkDoc;
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
        .then(partnerNetwork => {
            if (partnerNetwork) {
                let isAbleToUpdate = false;
                if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.params.id && element.roles === 'admin') {
                            isAbleToUpdate = true;
                        }
                    });
                }
                if (isAbleToUpdate) {
                    return voucherCollection.updateOne({
                        _id: req.params.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.params.partnerNetworkID
                    }, {
                        $set: Object.assign({}, utils.formatDateFields(req.body), { updatedDate: new Date() })
                    });
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant not able to update the partner network.',
                            404
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
        .then(result => {
            if (result && result.matchedCount) {
                return voucherCollection.findOne({
                    _id: req.params.partnerNetworkID,
                    docType: 'partnerNetworks',
                    partitionKey: req.params.partnerNetworkID
                });
            }
        })
        .then(result => {
            if (result) {
                partnerNetworkDoc = result;
                const partnerNetwork = Object.assign({}, result, { event: 'nameUpdated' });
                return utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_PARTNER_NETWORK_UPDATES, partnerNetwork);
            }
        })
        .then(() => {
            if (partnerNetworkDoc) {
                context.res = {
                    body: partnerNetworkDoc
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
