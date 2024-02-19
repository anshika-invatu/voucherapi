'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id)
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => collection.findOne({
            _id: req.params.id,
            docType: 'vouchers'
        }))
        .then(voucher => {
            if (voucher) {
                context.res = {
                    body: voucher
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherNotFoundError(
                        'The voucher id specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
