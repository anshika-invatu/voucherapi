'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-167 for further details

module.exports = async (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id,'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => collection.findOne({
            _id: req.params.id,
            issuerMerchantID: req.query.merchantID,
            docType: 'balanceAccount',
            partitionKey: req.params.id
        }))
        .then(result => {
            if (result) {
                context.res = {
                    body: result
                };
            } else {
                utils.setContextResError(
                    context,
                    new errors.BalanceAccountNotFoundError(
                        'The balance account of specified details in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
