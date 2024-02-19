'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = async (context, req) => {
   
    let voucherCollection = false, isError = false, isMember = false;

    if (!req.query.partnerNetworkID) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'Field partnerNetworkID is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }
    return utils
        .validateUUIDField(context, req.query.partnerNetworkID, 'The id field specified in the request does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return collection.findOne({
                merchantID: req.params.id,
                docType: 'merchantPartnerNetworks',
                partitionKey: req.params.id
            });
        })
        .then(merchantPartnerNetwork =>{
            if (merchantPartnerNetwork) {
                if (merchantPartnerNetwork.partnerNetworkInvites) {
                    merchantPartnerNetwork.partnerNetworkInvites.forEach(element => {
                        if (element.partnerNetworkID === req.query.partnerNetworkID) {
                            isMember = true;
                        }
                    });
                }
                if (!isMember) {
                    isError = true;
                    return utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotInvited(
                            'This merchant is not invited for this partner network.',
                            404
                        )
                    );
                }
                return voucherCollection.updateOne({
                    merchantID: req.params.id,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.params.id
                }, {
                    $pull: { partnerNetworkInvites: { partnerNetworkID: req.query.partnerNetworkID }}
                });
            } else {
                isError = true;
                utils.setContextResError(
                    context,
                    new errors.MerchantPartnerNetworkNotFoundError(
                        'The merchant partner network of specified details in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .then(result => {
            if (result) {
                if (result.matchedCount) {
                    return voucherCollection.updateOne({
                        _id: req.query.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.query.partnerNetworkID
                    }, { $pull: { partnerNetworkInvites: { merchantID: req.params.id }}
                    });
                }
            }

        })
        .then(result =>{
            if (result && result.matchedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deny partner network invite request.'
                    }
                };
            } else if (!isError) {
                utils.setContextResError(
                    context,
                    new errors.PartnerNetworkNotFoundError(
                        'The partnerNetwork of specified details in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
