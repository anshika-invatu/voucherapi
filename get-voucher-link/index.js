'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer bac-427 for this endpoint related details

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.partnerNetworkID, 'The partnerNetworkID field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const query = {
                partitionKey: req.params.partnerNetworkID,
                docType: 'voucherLink'
            };
            if (req.query.externalID) {
                query.linkedID = req.query.externalID.trim();
                query.linkedID = utils.hashToken(query.linkedID).toLowerCase();
            }
            if (req.query.voucherID) {
                query.voucherID = req.query.voucherID;
            }
            return collection.find(query).toArray();
        })
        .then(voucherLink => {
            if (voucherLink) {
                context.res = {
                    body: voucherLink
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherLinkNotFoundError(
                        'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
