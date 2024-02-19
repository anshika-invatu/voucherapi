'use strict';

const utils = require('../utils');
const { getMongodbCollection } = require('../db/mongodb');
const { CustomLogs } = utils;

module.exports = function (context, mySbMsg) {
    CustomLogs(`Transfer of amount from balance Accounts ${mySbMsg.fromBalanceAccountID} to ${mySbMsg.toBalanceAccountID}`,context);
    CustomLogs(`Transfer of amount  ${mySbMsg.transferAmount}`,context);
    let voucherCollections, fromBalanceAccount, toBalanceAccount;
    if (mySbMsg && mySbMsg.docType === 'balanceAccountTransactions' && mySbMsg.transactionStatus === 'pending' && mySbMsg.transferAmount && mySbMsg.transactionType !== 'order') {
        return getMongodbCollection('Vouchers')
            .then(collection => {
                voucherCollections = collection;
                mySbMsg.partitionKey = mySbMsg._id;
                return voucherCollections.insertOne(mySbMsg);

            })
            .then(result => {
                if (result && result.ops[0]) {
                    return voucherCollections.findOne({ _id: mySbMsg.fromBalanceAccountID, docType: 'balanceAccount' });
                }
            })
            .then(result => {
                if (result) {
                    fromBalanceAccount = result;
                    return voucherCollections.findOne({ _id: mySbMsg.toBalanceAccountID, docType: 'balanceAccount' });
                }
            })
            .then(result => {
                if (result) {
                    toBalanceAccount = result;
                    if (fromBalanceAccount.balanceCurrency === mySbMsg.transferCurrency && toBalanceAccount.balanceCurrency === mySbMsg.transferCurrency) {
                        if (fromBalanceAccount.balanceAmount >= mySbMsg.transferAmount) {
                            const reducedAmount = fromBalanceAccount.balanceAmount - mySbMsg.transferAmount;
                            const increaseAmount = toBalanceAccount.balanceAmount + mySbMsg.transferAmount;

                            return utils.updateVoucher(fromBalanceAccount, toBalanceAccount, reducedAmount, increaseAmount, voucherCollections);

                        }
                    }
                }
            })
            .then(result => {
                if (result && Array.isArray(result) && result[0].matchedCount && result[1].matchedCount) {
                    return utils.updateTransactionDoc(mySbMsg, 'successful', voucherCollections);
                } else {
                    throw 'Unable to update balanceAccount doc';
                }
            })
            .then(result => {
                if (result && result.matchedCount) {
                    const message = {};
                    message.transactionID = mySbMsg._id;
                    message.result = 'successful';
                    utils.logInfo(message);
                } else {
                    utils.updateTransactionDoc(mySbMsg, 'failed', voucherCollections);
                    const message = {};
                    message.transactionID = mySbMsg._id;
                    message.result = 'failed';
                    utils.logInfo(message);
                }
            })
            .catch(error => {
                if (error.code !== 1100) { //if duplicate doc inserted in database then error code is 1100
                    try {
                        utils.updateVoucher(fromBalanceAccount, toBalanceAccount, fromBalanceAccount.balanceAmount, toBalanceAccount.balanceAmount, voucherCollections);
                        utils.updateTransactionDoc(mySbMsg, 'failed', voucherCollections);
                        const message = {};
                        message.transactionID = mySbMsg._id;
                        message.result = 'failed';
                        
                    } catch (err) {
                        utils.logEvents(err.message);
                    }
                }
                utils.logEvents(error.message);
            });
    } else if (mySbMsg && mySbMsg.docType === 'balanceAccountTransactions' && mySbMsg.transactionStatus === 'pending' && mySbMsg.transferAmount && mySbMsg.transactionType === 'order') {
        return getMongodbCollection('Vouchers')
            .then(collection => {
                voucherCollections = collection;
                mySbMsg.partitionKey = mySbMsg._id;
                return voucherCollections.insertOne(mySbMsg);

            }).
            then(result => {
                if (result && result.ops[0]) {
                    return voucherCollections.findOne({ _id: mySbMsg.toBalanceAccountID, docType: 'balanceAccount', partitionKey: mySbMsg.toBalanceAccountID });
                }
            }).
            then(balanceAccount => {
                console.log(balanceAccount);
                if (balanceAccount) {
                    return voucherCollections.updateOne({
                        _id: mySbMsg.toBalanceAccountID,
                        docType: 'balanceAccount',
                        partitionKey: mySbMsg.toBalanceAccountID,
                    }, {
                        $set: {
                            balanceAmount: balanceAccount.balanceAmount + mySbMsg.transferAmount,
                            updatedDate: new Date()
                        }
                    });
                }
            }).
            then(result => {
                if (result) {
                    console.log(result.matchedCount);
                }
            }).
            catch(error => {
                context.log.error(error.message);
                utils.logEvents(error.message);
            });
    } else {
        return Promise.resolve();
    }

};