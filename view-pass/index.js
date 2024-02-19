'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {

    if (!req.query.passToken && !req.query.voucherToken) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'Please provide passToken or voucherToken.',
                400
            )
        );
        return Promise.resolve();
    }
    const filters = {
        docType: 'vouchers'
    };
    if (req.query.passToken) {
        filters.passToken = req.query.passToken.toLowerCase();
        filters.partitionKey = req.query.passToken.toLowerCase();
    }

    if (req.query.voucherToken) {
        filters.voucherToken = req.query.voucherToken;
    }

    return getMongodbCollection('Vouchers')
        .then(collection => {
            return collection.find(filters).toArray();
        })
        .then(vouchers => {
            if (vouchers) {
                context.res = {
                    body: vouchers
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
