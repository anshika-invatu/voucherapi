'use strict';

const uuid = require('uuid');
const utils = require('../utils');
const { getMongodbCollectionRegional } = require('../db/mongodb');
const { CustomLogs } = utils;

//Please refer the bac-173,243 for further details

module.exports = function (context, mySbMsg) {
    CustomLogs(`message received for voucher having _id = ${mySbMsg._id}`,context);
    const walletIDs = new Array();
    if (mySbMsg && mySbMsg.docType === 'vouchers' && mySbMsg.notificationSubscribers && Array.isArray(mySbMsg.notificationSubscribers)) {
        mySbMsg.notificationSubscribers.forEach(element => {
            if (mySbMsg.event === element.events || element.events === 'all') {
                walletIDs.push({ _id: element.walletID });
                walletIDs.push({ partitionKey: element.walletID });
            }
        });
    } else {
        return Promise.resolve();
    }
    if (walletIDs.length) {
        return getMongodbCollectionRegional('Wallets')
            .then(collection => {
                return collection.find(
                    {
                        $or: walletIDs,
                        docType: 'wallets',
                    }).toArray();
            })
            .then(wallets => {
                if (mySbMsg.event === 'redemption') {
                    if (wallets && Array.isArray(wallets)) {
                        wallets.forEach(element => {
                            if (element.sendNotifications && element.sendNotifications.onVoucherRedeemed) {
                                const notificationMessge = {};
                                notificationMessge._id = uuid.v4();
                                notificationMessge.receiver = { walletID: element._id };
                                notificationMessge.messageSubject = 'Vourity Voucher Redeemed';
                                notificationMessge.templateFields = {
                                    voucherTitle: mySbMsg.voucherTitle
                                };
                                if (mySbMsg.settlementList && mySbMsg.settlementList.settlementTransactions &&
                                    Array.isArray(mySbMsg.settlementList.settlementTransactions) &&
                                    mySbMsg.settlementList.settlementTransactions.length) {
                                    const lastIndex = mySbMsg.settlementList.settlementTransactions.length - 1;
                                    notificationMessge.templateFields.merchantName = mySbMsg.settlementList.settlementTransactions[lastIndex].merchantName;
                                }
                                notificationMessge.template = 'voucher-redeemed';
                                notificationMessge.updatedDate = new Date();
                                notificationMessge.createdDate = new Date();
                                try {
                                    utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_NOTIFICATION_EMAIL, notificationMessge);
                                    CustomLogs(`message sent on topic ${process.env.AZURE_BUS_TOPIC_NOTIFICATION_EMAIL} for voucher having _id = ${mySbMsg._id}`,context);
                                } catch (err) {
                                    context.log.error(err);
                                    utils.logEvents(err.message);
                                }
                            }
                        });
                    }
                }
            });
    } else {
        return Promise.resolve();
    }
};






