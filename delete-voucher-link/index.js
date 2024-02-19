'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer bac-427 for this endpoint related details

module.exports = (context, req) => {
    if (!req.query.partnerNetworkID) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'partnerNetworkID is not present in req url.',
                409
            )
        );
        return Promise.resolve();
    }
    return utils
        .validateUUIDField(context, req.params.id, 'The _id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            return collection.deleteOne({
                _id: req.params.id,
                partitionKey: req.query.partnerNetworkID,
                docType: 'voucherLink'
            });
        })
        .then(result => {
            if (result && result.deletedCount === 1) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deleted the specified voucher-link'
                    }
                };
                
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherLinkNotFoundError(
                        'The voucherLink _id specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
