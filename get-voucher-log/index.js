'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.body.voucherID, 'The voucherID field specified in the request does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const query = {
                voucherID: req.body.voucherID,
                partitionKey: req.body.voucherID,
                docType: 'voucherLog',
                merchantID: { $in: req.body.merchantIDs }
            };
            return collection.find(query).sort({ 'createdDate': -1 })
                .limit(50)
                .toArray();
        })
        .then(result => {
            if (result) {
                context.res = {
                    body: result
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherLogNotFoundError(
                        'The VoucherLog of specified voucherID in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
