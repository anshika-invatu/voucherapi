'use strict';

const utils = require('../utils');
const { getMongodbCollection } = require('../db/mongodb');
const { CustomLogs } = utils;

//Please refer the bac-172 for further details

module.exports = function (context, mySbMsg) {
    CustomLogs(mySbMsg,context);
    let voucherCollections;
    if (mySbMsg) {
        return getMongodbCollection('Vouchers')
            .then(collection => {
                voucherCollections = collection;
                return collection.findOne({
                    _id: mySbMsg.voucherID,
                    docType: 'vouchers'
                });
            })
            .then(voucher => {
                if (mySbMsg.docType === 'voucherLog') {
                    const logMessage = {};
                    if (voucher) {
                        logMessage.eventText = voucher.event;
                    }
                    logMessage.voucherID = mySbMsg.voucherID;
                    logMessage.actionText = mySbMsg.actionText;
                    logMessage.actionCode = mySbMsg.actionCode;
                    logMessage.statusText = mySbMsg.statusText;
                    logMessage.statusCode = mySbMsg.statusCode;
                    utils.logInfo(logMessage);
                    mySbMsg.createdDate = new Date(mySbMsg.createdDate);
                    mySbMsg.updatedDate = new Date(mySbMsg.updatedDate);
                    voucherCollections.insertOne(mySbMsg);
                }

            })
            .catch(error =>  {
                //utils.handleError(context, error);
                utils.logEvents(error.message);
            });
    } else {
        return Promise.resolve();
    }
};