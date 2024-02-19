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
                _id: req.params.id,
                docType: 'partnerNetworks',
                partitionKey: req.params.id
            });
        })
        .then(partnerNetworks => {
            if (partnerNetworks) {
                context.res = {
                    body: partnerNetworks
                };
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
        .catch(error => utils.handleError(context, error));
};
