'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id,'The merchantID field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => collection.find({
            ownerID: req.params.id,
            balanceAccountType: 'balance',
            docType: 'balanceAccount'
        }).toArray())
        .then(result => {
            if (result) {
                context.res = {
                    body: result
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.BalanceAccountNotFoundError(
                        'The balance account of specified merchantID in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
