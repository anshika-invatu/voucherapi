'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = async (context, req) => {
   
    let voucherCollection = false, isMember = false;

    if (!req.query.partnerNetworkID || !req.query.requestedMerchantID) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'Field partnerNetworkID and requestedMerchantID is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }
    return utils
        .validateUUIDField(context, req.query.partnerNetworkID, 'The id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return collection.findOne({
                _id: req.query.partnerNetworkID,
                docType: 'partnerNetworks',
                partitionKey: req.query.partnerNetworkID
            });
        })
        .then(partnerNetwork =>{
            if (partnerNetwork) {
                let isAbleToUpdate = false;
                if (partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.query.requestedMerchantID && element.roles === 'admin') {
                            isAbleToUpdate = true;
                        }
                    });
                }
                if (partnerNetwork.partnerNetworkRequests && Array.isArray(partnerNetwork.partnerNetworkRequests)) {
                    partnerNetwork.partnerNetworkRequests.forEach(element => {
                        if (element.merchantID === req.params.id) {
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
                        _id: req.query.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.query.partnerNetworkID
                    }, { $pull: { partnerNetworkRequests: { merchantID: req.params.id }}
                    });
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant not allowed to perform this section.',
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
        .then(result =>{
            if (result && result.matchedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deny partner network member request.'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
