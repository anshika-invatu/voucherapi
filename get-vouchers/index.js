'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    if (!req.query.passToken) {
        utils.setContextResError(
            context,
            new errors.MissingPassTokenError(
                'Field passToken is missing from request query params.',
                400
            )
        );
        return Promise.resolve();
    }

    const filters = {
        docType: 'vouchers',
        passToken: req.query.passToken.toLowerCase(),
        partitionKey: req.query.passToken.toLowerCase()//bac-178 related to partitionKey
    };

    if (req.query.voucherToken) {
        filters['voucherToken'] = req.query.voucherToken;
    }

    return getMongodbCollection('Vouchers')
        .then(collection => collection.find(filters).toArray())
        .then(vouchers => {
            context.res = {
                body: vouchers
            };
        })
        .catch(error => utils.handleError(context, error));
};
