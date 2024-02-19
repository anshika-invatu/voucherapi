'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = (context, req) => {
    let voucherCollection, isDeleted = false, partnerNetworkDoc;
    return utils
        .validateUUIDField(context, req.params.partnerNetworkID,'The id field specified in the request URL does not match the UUID v4 format.')
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
                let isAbleToDelete = false;
                partnerNetworkDoc = partnerNetwork;
                if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
                    partnerNetwork.partnerNetworkMembers.forEach(element => {
                        if (element.merchantID === req.params.id && element.roles === 'admin') {
                            isAbleToDelete = true;
                        }
                    });
                }
                if (isAbleToDelete) {
                    return voucherCollection.deleteOne({
                        _id: req.params.partnerNetworkID,
                        docType: 'partnerNetworks',
                        partitionKey: req.params.partnerNetworkID
                    });
                } else {
                    utils.setContextResError(
                        context,
                        new errors.PartnerNetworkNotAuthorized(
                            'The given merchant not able to delete the partner network.',
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
            if (result && result.deletedCount === 1) {
                isDeleted = true;
                return voucherCollection.findOne({
                    partitionKey: partnerNetworkDoc.ownerMerchantID,
                    merchantID: partnerNetworkDoc.ownerMerchantID,
                    docType: 'merchantPartnerNetworks'
                });
            }
        })
        .then(merchantPartnerNetworksDoc =>{
            if (merchantPartnerNetworksDoc) {
                return voucherCollection.updateOne({
                    partitionKey: partnerNetworkDoc.ownerMerchantID,
                    merchantID: partnerNetworkDoc.ownerMerchantID,
                    docType: 'merchantPartnerNetworks'
                },
                {
                    $pull: { partnerNetworkMemberships: {
                        partnerNetworkID: req.params.partnerNetworkID
                    }}
                });
            }
        })
        .then(result => {
            if (result && isDeleted) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deleted the partnerNetwork of specified details'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
