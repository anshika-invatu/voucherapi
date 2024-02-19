'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    if (!req.query.voucherID) {
        utils.setContextResError(
            context,
            new errors.MissingVoucherIDError(
                'Field voucherID is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }
    return utils
        .validateUUIDField(context, req.query.voucherID, 'The voucherID field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => collection.find({
            voucherID: req.query.voucherID,
            partitionKey: req.query.voucherID,
            docType: 'voucherLog'
        }).sort({ 'createdDate': -1 })
            .limit(100)
            .toArray())
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
