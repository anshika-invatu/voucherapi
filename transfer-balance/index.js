'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');
const { CustomLogs } = utils;

module.exports = function (context, req) {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'The request should have balance account transaction',
                400
            )
        );
        return Promise.resolve();
    }
    context.log(`request body =${JSON.stringify(req.body)}`);
    CustomLogs(`request body =${JSON.stringify(req.body)}`,context);
    let voucherCollections, fromBalanceAccount, toBalanceAccount;
    if (req.body && req.body.docType === 'balanceAccountTransactions' && req.body.transactionStatus === 'pending' && req.body.transferAmount) {
        return getMongodbCollection('Vouchers')
            .then(collection => {
                voucherCollections = collection;
                return voucherCollections.insertOne(req.body);

            })
            .then(result => {
                if (result && result.ops[0]) {
                    return voucherCollections.findOne({ _id: req.body.fromBalanceAccountID, partitionKey: req.body.fromBalanceAccountID, docType: 'balanceAccount' });
                }
            })
            .then(result => {
                if (result) {
                    fromBalanceAccount = result;
                    return voucherCollections.findOne({ _id: req.body.toBalanceAccountID, partitionKey: req.body.toBalanceAccountID, docType: 'balanceAccount' });
                }
            })
            .then(result => {
                if (result) {
                    toBalanceAccount = result;
                    if (fromBalanceAccount.balanceCurrency === req.body.transferCurrency && toBalanceAccount.balanceCurrency === req.body.transferCurrency) {
                        if (fromBalanceAccount.balanceAmount >= req.body.transferAmount) {
                            const reducedAmount = fromBalanceAccount.balanceAmount - req.body.transferAmount;
                            const increaseAmount = toBalanceAccount.balanceAmount + req.body.transferAmount;

                            return utils.updateVoucher(fromBalanceAccount, toBalanceAccount, reducedAmount, increaseAmount, voucherCollections);

                        } else {
                            return Promise.reject(
                                new errors.TransactionError(
                                    'From balance account have less money than the money to be transfered',
                                    401
                                )
                            );
                        }
                    } else {
                        utils.setContextResError(
                            context,
                            new errors.TransactionError(
                                'Currency mismatch',
                                400
                            )
                        );
                    }
                }
            })
            .then(result => {
                if (result && Array.isArray(result) && result[0].matchedCount && result[1].matchedCount) {
                    return utils.updateTransactionDoc(req.body, 'successful', voucherCollections);
                } else {
                    return Promise.reject(
                        new errors.TransactionError(
                            'Unable to update balanceAccount doc',
                            400
                        )
                    );
                }
            })
            .then(result => {
                if (result && result.matchedCount) {
                    const message = {};
                    message.transactionID = req.body._id;
                    message.result = 'successful';
                    utils.logInfo(message);
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Successfully transfer the balance'
                        }
                    };
                } else {
                    utils.updateTransactionDoc(req.body, 'failed', voucherCollections);
                    const message = {};
                    message.transactionID = req.body._id;
                    message.result = 'failed';
                    utils.logInfo(message);
                    utils.setContextResError(
                        context,
                        new errors.TransactionError(
                            'Unable to complete transaction successfully',
                            400
                        )
                    );
                }
            })
            .catch(error => {
                if (error) {
                    if (fromBalanceAccount && toBalanceAccount) {
                        utils.updateVoucher(fromBalanceAccount, toBalanceAccount, fromBalanceAccount.balanceAmount, toBalanceAccount.balanceAmount, voucherCollections);
                    }
                    utils.updateTransactionDoc(req.body, 'failed', voucherCollections);
                    const message = {};
                    message.transactionID = req.body._id;
                    message.result = 'failed';
                    CustomLogs(message,context);
                    utils.handleError(context, error);
                }
            });
    } else {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'Please check the fields of balance account transaction doc',
                400
            )
        );

        return Promise.resolve();
    }
};