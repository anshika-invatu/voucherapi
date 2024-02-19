'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-346, 368 for further details

module.exports = async (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id, 'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            return collection.findOne({
                merchantID: req.params.id,
                docType: 'merchantPartnerNetworks',
                partitionKey: req.params.id
            });
        })
        .then(merchantPartnerNetworks => {
            if (merchantPartnerNetworks) {
                context.res = {
                    body: merchantPartnerNetworks
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.MerchantPartnerNetworkNotFoundError(
                        'The merchantPartnerNetworks of specified details in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
