'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer the bac-167 for further details

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to update a balanceAccount but the request body seems to be empty. Kindly pass the balanceAccount fields to be updated using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }

    return utils
        .validateUUIDField(context, req.params.id, 'The id field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            if (req.body.balanceAmount) {
                delete req.body.balanceAmount;
            }
            if (req.body.balanceAccountType) {
                delete req.body.balanceAccountType;
            }
            if (req.body.creditLimit) {
                delete req.body.creditLimit;
            }
            if (req.body.creditInterestRate) {
                delete req.body.creditInterestRate;
            }
            if (req.body.balanceCurrency) {
                delete req.body.balanceCurrency;
            }
            if (Object.keys(req.body).length) {
                return collection.updateOne({
                    _id: req.params.id,
                    issuerMerchantID: req.query.merchantID,
                    docType: 'balanceAccount',
                    partitionKey: req.params.id
                }, {
                    $set: Object.assign(
                        {},
                        utils.formatDateFields(req.body),
                        {
                            updatedDate: new Date()
                        }
                    )
                });
            } else {
                return Promise.resolve();
            }
        })
        .then(result => {
            if (result) {
                if (result.matchedCount) {
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Successfully updated the document'
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
            }

        })
        .catch(error => utils.handleError(context, error));
};
