'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = async (context, req) => {
   
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to remove a partnerNetworkInvite but the request body seems to be empty. Kindly pass the request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }

    let voucherCollection = false, isMember = false;
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
        .then(partnerNetwork =>{
            if (partnerNetwork) {
                let isAbleToUpdate = false;
                if (partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.body.requestedMerchantID && element.roles === 'admin') {
                            isAbleToUpdate = true;
                        }
                    });
                }
                if (partnerNetwork.partnerNetworkInvites && Array.isArray(partnerNetwork.partnerNetworkInvites)) {
                    partnerNetwork.partnerNetworkInvites.forEach(element => {
                        if (element.merchantID === req.body.merchantID) {
                            isMember = true;
                        }
                    });
                }
                if (!isMember) {
                    return utils.setContextResError(
                        context,
                        new errors.MerchantNotMemberError(
                            'This merchant is not a available in partner network invites.',
                            404
                        )
                    );
                }
                if (isAbleToUpdate) {
                    return voucherCollection.updateOne({
                        _id: req.body.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.body.partnerNetworkID
                    }, {
                        $pull: { partnerNetworkInvites: { merchantID: req.body.merchantID }}
                    });
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant not able to delete the partner network member.',
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
            if (result) {
                if (result.matchedCount) {
                    return voucherCollection.updateOne({
                        merchantID: req.body.merchantID,
                        docType: 'merchantPartnerNetworks',
                        partitionKey: req.body.merchantID
                    }, { $pull: { partnerNetworkInvites: { partnerNetworkID: req.body.partnerNetworkID }}
                    });
                }
            }

        })
        .then(result =>{
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
