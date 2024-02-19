'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = async (context, req) => {
   
    let voucherCollection = false, partnerNetworkDoc, isMember = false;
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
        .then(partnerNetwork =>{
            if (partnerNetwork) {
                partnerNetworkDoc = partnerNetwork;
                let isAbleToUpdate = false;
                if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.query.requestedMerchantID && element.roles === 'admin') {
                            isAbleToUpdate = true;
                        }
                        if (element.merchantID === req.params.merchantID) {
                            isMember = true;
                        }
                    });
                }
                if (!isMember) {
                    return utils.setContextResError(
                        context,
                        new errors.MerchantNotMemberError(
                            'This merchant is not a available in partner network request.',
                            404
                        )
                    );
                }
                if (isAbleToUpdate) {
                    return voucherCollection.updateOne({
                        _id: req.params.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.params.partnerNetworkID
                    }, {
                        $pull: { partnerNetworkMembers: { merchantID: req.params.merchantID }}
                    });
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant is not admin of partner network.',
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
        .then(result => {
            if (result && result.matchedCount) {
                return voucherCollection.updateOne({
                    merchantID: partnerNetworkDoc.ownerMerchantID,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: partnerNetworkDoc.ownerMerchantID
                }, {
                    $pull: { partnerNetworkMemberships: { partnerNetworkID: req.params.partnerNetworkID }}
                });
            }
        })
        .then (result => {
            if (result && result.matchedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deleted the partner network members'
                    }
                };
            }

        })
        .catch(error => utils.handleError(context, error));
};
