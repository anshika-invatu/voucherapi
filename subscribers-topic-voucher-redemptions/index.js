'use strict';

const utils = require('../utils');
const { getMongodbCollection } = require('../db/mongodb');

//Please refer the bac-177 for further details

module.exports = function (context, mySbMsg) {
    if (mySbMsg && mySbMsg.docType === 'redemption') {
        context.log(JSON.stringify(mySbMsg));
        //return utils.sendMessageToQueue(process.env.MERCHANT_REDEMPTION_QUEUE, mySbMsg)
        return getMongodbCollection('Vouchers')
            .then(collection => {
                mySbMsg._ts = new Date();
                mySbMsg.ttl = 60 * 60 * 24 * 30 * 15;  //15 months
                mySbMsg.redemptionDate = new Date(mySbMsg.redemptionDate);
                mySbMsg.orderDate = new Date(mySbMsg.orderDate);
                mySbMsg.createdDate = new Date(mySbMsg.createdDate);
                mySbMsg.updatedDate = new Date(mySbMsg.updatedDate);
                mySbMsg.voucherCreatedDate = new Date(mySbMsg.voucherCreatedDate);
                collection.insertOne(mySbMsg);
            })
            .catch(error => {
                context.log.error(error);
                utils.logEvents(error.message);
                //utils.handleError(context, error);
            });
    } else {
        return Promise.resolve();
    }
};