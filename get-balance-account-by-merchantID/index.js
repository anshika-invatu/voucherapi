'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id, 'The merchantID field specified in the request URL does not match the UUID v4 format.')
        .then(() => {
            context.log('create connection with db');
            return getMongodbCollection('Vouchers');
        })
        .then(collection => {
            context.log('connection create with db succesfully');
            return collection.find({
                ownerID: req.params.id,
                docType: 'balanceAccount',
                ownerType: 'merchant'
            }).toArray();
        })
        .then(result => {
            context.log('query get all data');
            if (result) {
                context.log('count of balanceAccount = ' + result.length);
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
