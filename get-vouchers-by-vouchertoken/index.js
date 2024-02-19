'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = (context, req) => {

    return utils
        .validateUUIDField(context, req.params.voucherToken, 'The voucher token specified in the URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            return collection.find(
                {
                    voucherToken: req.params.voucherToken,
                    docType: 'vouchers'
                }).toArray();
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
