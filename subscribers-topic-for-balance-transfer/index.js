'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const { CustomLogs } = utils;

//Please refer the bac-175 for further details

module.exports = async function (context, mySbMsg) {

    context.log(`request body =${JSON.stringify(mySbMsg)}`);
    CustomLogs(`request body =${JSON.stringify(mySbMsg.balanceAccountTransaction.messageCount)}`, context);
    let fromBalanceAccount, toBalanceAccount, updatedBalanceAccount, updatedTransactionDoc, isBalanceAccountTransferOK = false;
    if (mySbMsg && mySbMsg.balanceAccountTransaction && mySbMsg.balanceAccountTransaction.docType === 'balanceAccountTransactions' && mySbMsg.balanceAccountTransaction.transactionStatus === 'pending' && mySbMsg.balanceAccountTransaction.transferAmount) {
        const voucherCollections = await getMongodbCollection('Vouchers');
        const result = await voucherCollections.insertOne(mySbMsg.balanceAccountTransaction);
        try {
            if (result && result.ops[0]) {
                fromBalanceAccount = await voucherCollections.findOne({ _id: mySbMsg.balanceAccountTransaction.fromBalanceAccountID, partitionKey: mySbMsg.balanceAccountTransaction.fromBalanceAccountID, docType: 'balanceAccount' });

                toBalanceAccount = await voucherCollections.findOne({ _id: mySbMsg.balanceAccountTransaction.toBalanceAccountID, partitionKey: mySbMsg.balanceAccountTransaction.toBalanceAccountID, docType: 'balanceAccount' });

                if (fromBalanceAccount.balanceCurrency === mySbMsg.balanceAccountTransaction.transferCurrency && toBalanceAccount.balanceCurrency === mySbMsg.balanceAccountTransaction.transferCurrency) {
                    if (fromBalanceAccount.balanceAmount >= mySbMsg.balanceAccountTransaction.transferAmount) {
                        const reducedAmount = fromBalanceAccount.balanceAmount - mySbMsg.balanceAccountTransaction.transferAmount;
                        const increaseAmount = toBalanceAccount.balanceAmount + mySbMsg.balanceAccountTransaction.transferAmount;

                        updatedBalanceAccount = await utils.updateVoucher(fromBalanceAccount, toBalanceAccount, reducedAmount, increaseAmount, voucherCollections);

                    } else {
                        isBalanceAccountTransferOK = false;
                        context.log('From balance account have less money than the money to be transfered');
                    }
                } else {
                    isBalanceAccountTransferOK = false;
                    context.log('Currency mismatch');
                }

                if (updatedBalanceAccount && Array.isArray(updatedBalanceAccount) && updatedBalanceAccount[0].matchedCount && updatedBalanceAccount[1].matchedCount) {
                    isBalanceAccountTransferOK = true;
                    const message = {};
                    message.transactionID = mySbMsg.balanceAccountTransaction._id;
                    message.result = 'successful';
                    utils.logInfo(message);
                    context.log('Successfully transfer the balance');
                    updatedTransactionDoc = await utils.updateTransactionDoc(mySbMsg.balanceAccountTransaction, 'successful', voucherCollections,fromBalanceAccount.balanceAmount,toBalanceAccount.balanceAmount);
                } else {
                    isBalanceAccountTransferOK = false;
                    utils.updateTransactionDoc(mySbMsg.balanceAccountTransaction, 'failed', voucherCollections);
                    context.log('Unable to update balanceAccount doc');
                    const message = {};
                    message.transactionID = mySbMsg.balanceAccountTransaction._id;
                    message.result = 'failed';
                    utils.logInfo(message);
                    context.log('Unable to complete transaction successfully');
                }


                if (updatedTransactionDoc && updatedTransactionDoc.matchedCount) {
                    const message = {};
                    message.balanceAccountTransactionDoc = mySbMsg;
                    message.transferLogsMessage = 'balance transaction doc updated successfully';
                    utils.logInfo(message);

                } else {
                    const message = {};
                    message.balanceAccountTransactionDoc = mySbMsg;
                    message.transferLogsMessage = 'balance transaction doc not updated successfully';
                    utils.logInfo(message);
                }
            }
        } catch (error) {
            isBalanceAccountTransferOK = false;
            if (fromBalanceAccount && toBalanceAccount) {
                utils.updateVoucher(fromBalanceAccount, toBalanceAccount, fromBalanceAccount.balanceAmount, toBalanceAccount.balanceAmount, voucherCollections);
            }
            utils.updateTransactionDoc(mySbMsg.balanceAccountTransaction, 'failed', voucherCollections);
            const message = {};
            message.transactionID = mySbMsg.balanceAccountTransaction._id;
            message.result = 'failed';
            CustomLogs(message, context);
            utils.handleError(context, error);
        }
    } else {
        context.log('Please check the fields of balance account transaction doc');

        return Promise.resolve();
    }
    const message = mySbMsg;
    message.isBalanceAccountTransferOK = isBalanceAccountTransferOK;
    //delete message.balanceAccountTransaction;
    return utils.sendMessageToAzureBusQueue(process.env.AZURE_BUS_TOPIC_CLEARING_TRANSACTIONS_AFTER_BALANCE_TRANSFER, message);
};