'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = async (context, req) => {
   
    let voucherCollection = false, isMember = false, isError = false;
    return utils
        .validateUUIDField(context, req.query.partnerNetworkID, 'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return voucherCollection.findOne({
                _id: req.query.partnerNetworkID,
                docType: 'partnerNetworks',
                partitionKey: req.query.partnerNetworkID
            });
        })
        .then(partnerNetwork =>{
            if (partnerNetwork) {
                if (partnerNetwork.partnerNetworkMembers) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.params.id) {
                            isMember = true;
                        }
                    });
                }
                if (!isMember) {
                    isError = true;
                    return utils.setContextResError(
                        context,
                        new errors.MerchantNotMemberError(
                            'This merchant is not a member of this partner network.',
                            404
                        )
                    );
                }
                return voucherCollection.updateOne({
                    _id: req.query.partnerNetworkID,
                    docType: 'partnerNetworks',
                    partitionKey: req.query.partnerNetworkID
                }, {
                    $pull: { partnerNetworkMembers: { merchantID: req.params.id }}
                });
            }
        })
        .then(result => {
            if (result && result.matchedCount) {
                return voucherCollection.updateOne({
                    merchantID: req.params.id,
                    docType: 'merchantPartnerNetworks',
                    partitionKey: req.params.id
                }, {
                    $pull: { partnerNetworkMemberships: { partnerNetworkID: req.query.partnerNetworkID }}
                });
            } else if (!isError) {
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
            if (result) {
                if (result.matchedCount) {
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Successfully deleted own membership from the partner network'
                        }
                    };
                } else if (!isError) {
                    utils.setContextResError(
                        context,
                        new errors.MerchantPartnerNetworkNotFoundError(
                            'The merchant partnerNetwork of specified details in the URL doesn\'t exist.',
                            404
                        )
                    );
                }
            }
        })
        .catch(error => utils.handleError(context, error));
};
