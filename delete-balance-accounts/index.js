'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

//Please refer the bac-167 for further details

module.exports = (context, req) => {

    if (!req.query.merchantID) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'Please provide merchantID in query parameter in request url.',
                409
            )
        );
        return Promise.resolve();
    }

    return utils
        .validateUUIDField(context, req.params.id,'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => collection.deleteOne({
            _id: req.params.id,
            issuerMerchantID: req.query.merchantID,
            partitionKey: req.params.id,
            docType: 'balanceAccount'
        }))
        .then(result => {
            if (result && result.deletedCount === 1) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Successfully deleted the balanceAccount of specified details'
                    }
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
