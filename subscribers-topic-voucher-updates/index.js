'use strict';

const utils = require('../utils');
const uuid = require('uuid');
const { getMongodbCollection } = require('../db/mongodb');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CustomLogs } = utils;

//Please refer the bac-170 for further details

module.exports = function (context, mySbMsg) {
  
    CustomLogs(`voucher with _id =${mySbMsg._id} has event =${mySbMsg.event}`,context);
    let voucherCollections;
    if (mySbMsg) {
        return getMongodbCollection('Vouchers')
            .then(collection => {
                voucherCollections = collection;
            })
            .then(() => {
                if (mySbMsg.docType === 'vouchers') {
                    const logMessage = {};
                    logMessage.voucherID = mySbMsg._id;
                    logMessage.eventText = mySbMsg.event;
                    logMessage.actionText = mySbMsg.event;
                    logMessage.actionCode = mySbMsg.event;
                    logMessage.statusText = 'Voucher ' + mySbMsg.event;
                    logMessage.statusCode = 'OK';
                    utils.logInfo(logMessage);

                    const vouchersLog = {};
                    let result;
                    if (mySbMsg.event === 'redemption') {
                        result = 'Voucher was redeemed';
                    }
                    if (mySbMsg.event === 'created') {
                        result = 'Voucher was created';
                    }
                    if (mySbMsg.event === 'updated') {
                        result = 'Voucher was updated';
                    }
                    if (mySbMsg.event === 'deleted') {
                        result = 'Voucher was deleted';
                    }
                    if (mySbMsg.event === 'locked') {
                        result = 'Voucher was locked';
                    }
                    if (mySbMsg.event === 'unlocked') {
                        result = 'Voucher was unlocked';
                    }
                    CustomLogs(`voucher with _id =${mySbMsg._id} has result =${result}`,context);
                    vouchersLog._id = uuid.v4();
                    vouchersLog.docType = 'voucherLog';
                    vouchersLog.partitionKey = mySbMsg._id;
                    vouchersLog.voucherID = mySbMsg._id;
                    vouchersLog.voucherName = mySbMsg.voucherTitle;
                    vouchersLog.actionText = 'Voucher ' + mySbMsg.event;
                    vouchersLog.actionCode = 'voucher ' + mySbMsg.event;
                    vouchersLog.statusText = 'OK';
                    vouchersLog.statusCode = 'ok';
                    vouchersLog.result = result;
                    vouchersLog.createdDate = new Date();
                    vouchersLog.updatedDate = new Date();

                    return voucherCollections.insertOne(vouchersLog);
                }
            })
            .then(async result => {
                if (result) {
                    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
                    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
                    const containerName = process.env.BLOB_CONTAINER;
                    const containerClient = blobServiceClient.getContainerClient(containerName);
                    const voucher = JSON.stringify(mySbMsg);
                    const fileName = `Voucher_${mySbMsg._id}_${Math.floor((Date.now()) / 1000)}.json`;
                    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
                    const uploadBlobResponse = await blockBlobClient.upload(voucher, voucher.length);
                    console.log(`Upload block blob ${fileName} successfully`, uploadBlobResponse.requestId);
                
                }
            })
            .catch(error =>{
                context.log.error(error);
                utils.logEvents(error.message);
                //utils.handleError(context, error);
            });
    } else {
        return Promise.resolve();
    }
};