'use strict';

const Promise = require('bluebird');
const validator = require('validator');
const errors = require('../errors');
const { ServiceBusClient } = require('@azure/service-bus');
const { BlobServiceClient } = require('@azure/storage-blob');
const { MongoError } = require('mongodb');
const weekdaysHash = require('./weekdaysHash');
const crypto = require('crypto');
const uuid = require('uuid');
const request = require('request-promise');
const token = process.env.LOGGLY_TOKEN;
const { merchantApiErrorCodes } = require('../errors/api-error-codes');
const SessionId = uuid.v4();

exports.logInfo = async (message) => {
    console.log(message);
    var logMessage = Object.assign({}, message);
    logMessage.functionName = 'VoucherApi';

    await request.post(`${process.env.LOGGLE_URL}/inputs/${token}/tag/http/`, {
        json: true,
        body: logMessage,
        headers: {
            'content-type': 'application/json'
        }
    });
};

exports.logEvents = async (message) => {
    var error = Object.assign({}, message);
    error.functionName = 'OrderService';
    await request.post(`${process.env.LOGGLE_URL}/inputs/${token}/tag/http/`, {
        json: true,
        body: error,
        headers: {
            'content-type': 'application/json'
        }
    });
};

exports.CustomLogs = async (message,context) => {
    var logMessage = {};
    if (!context)
        context = { executionContext: {}};
    let methodName;
    if (context.executionContext)
        methodName = context.executionContext.functionName ? context.executionContext.functionName : null;
    logMessage.methodName = methodName;
    logMessage.logMessage = message;
    logMessage.functionName = 'OrderService';
    logMessage.env = process.env.ENV;
    logMessage.type = 'Custom';
   
    await request.post(`${process.env.LOGGLE_URL}/inputs/${token}/tag/http/`, {
        json: true,
        body: logMessage,
        headers: {
            'content-type': 'application/json'
        }
    });
};


exports.handleError = (context, error) => {
    context.log.error('voucherApi error = ' + error);
    switch (error.constructor) {
        case errors.TransactionError:
        case errors.MissingMerchantIDError:
        case errors.MissingBalanceAccountIDError:
        case errors.IncorrectMerchantIDError:
        case errors.RedemptionCostError:
        case errors.MerchantIDNotLinked:
        case errors.DuplicateVoucherError:
        case errors.EmptyRequestBodyError:
        case errors.InvalidUUIDError:
        case errors.MissingPassTokenError:
        case errors.MissingVoucherTokenError:
        case errors.VoucherNotFoundError:
        case errors.VoucherLinkNotFoundError:
        case errors.VouchersApiServerError:
        case errors.VoucherRedeemdedError:
        case errors.VoucherLockedError:
        case errors.VoucherExpiredError:
        case errors.VoucherValidWeekdaysError:
        case errors.VoucherValidTimeError:
        case errors.IncorrectVoucherPinCodeError:
        case errors.MissingRedemptionCodeError:
        case errors.IncorrectRedemptionCodeError:
        case errors.MissingSalesPersonCodeError:
        case errors.MissingFixedAmountError:
        case errors.MissingCurrencyError:
        case errors.IncorrectSettleValueOnRedemptionError:
        case errors.VoucherCurrencyMismatchError:
        case errors.RedemptionFixedAmountExceededError:
        case errors.MissingRedemptionsCountError:
        case errors.NoRedemptionsLeftError:
        case errors.BalanceAccountNotFoundError:
            this.setContextResError(context, error);
            break;
        case MongoError:
            this.handleMongoErrors(context, error);
            break;
        default:
            this.handleDefaultError(context, error);
            break;
    }
};

exports.hashToken = token => crypto.createHash('sha512')
    .update(`${token}`)
    .digest('hex');

exports.validateUUIDField = (context, id, message = 'The voucher id specified in the URL does not match the UUID v4 format.') => {
    return new Promise((resolve, reject) => {
        if (validator.isUUID(id, 4)) {
            resolve();
        } else {
            reject(
                new errors.InvalidUUIDError(message, 400)
            );
        }
    });
};

/**
 *
 * @param {any} context Context object from Azure function
 * @param {BaseError} error Custom error object of type base error
 */
exports.setContextResError = (context, error) => {
    context.res = {
        status: error.code,
        body: {
            code: error.code,
            description: error.message,
            reasonPhrase: error.name
        }
    };
};

exports.handleDefaultError = (context, error) => {
    const response = error.error;
    if (response && response.reasonPhrase) {
        if (merchantApiErrorCodes.includes(response.reasonPhrase)) {
            const errorFormatted = new errors.MerchantApiError(
                response.reasonPhrase,
                response.description,
                response.code
            );

            this.setContextResError(
                context,
                errorFormatted
            );
            context.log.error(error.message || error);
            context.log.error(error);
        } else {
            this.setContextResError(
                context,
                new errors.VouchersApiServerError(
                    'Something went wrong. Please try again later.',
                    500
                )
            );
        }
    } else {
        this.setContextResError(
            context,
            new errors.VouchersApiServerError(
                'Something went wrong. Please try again later.',
                500
            )
        );
    }
};

exports.handleMongoErrors = (context, error) => {
    switch (error.code) {
        case 11000:
            handleDuplicateDocumentInserts(context);
            break;
        default:
            this.handleDefaultError(context, error);
            break;
    }
};

const handleDuplicateDocumentInserts = context => {
    let className, entity;

    if (context.req.body.docType === 'vouchers') {
        className = 'DuplicateVoucherError';
        entity = 'vouchers';
    } else if (context.req.body.docType === 'balanceAccount') {
        className = 'DuplicateBalanceAccountError';
        entity = 'balanceAccount';
    } else if (context.req.body.docType === 'balanceAccountTransactions') {
        className = 'DuplicateBalanceAccountTransactions';
        entity = 'balanceAccountTransactions';
    } else if (context.req.body.docType === 'partnerNetworks') {
        className = 'DuplicatePartnerNetworkss';
        entity = 'partnerNetworks';
    }

    this.setContextResError(
        context,
        new errors[className](
            `You've requested to create a new ${entity} but a ${entity} with the specified _id field already exists.`,
            409
        )
    );
};

exports.expandWeekdayCodes = weekdaysString => {
    return weekdaysString
        .split(',')
        .map(code => weekdaysHash[code])
        .join(', ');
};

exports.hashToken = token => crypto.createHash('sha512')
    .update(`${token}`)
    .digest('hex');

exports.formatDateFields = voucher => {
    if (voucher['orderDate']) {
        voucher['orderDate'] = new Date(voucher['orderDate']);
    }

    if (voucher.validPeriod) {
        if (voucher.validPeriod.validFromDate) {
            voucher.validPeriod.validFromDate = new Date(voucher.validPeriod.validFromDate);
        }

        if (voucher.validPeriod.validToDate) {
            voucher.validPeriod.validToDate = new Date(voucher.validPeriod.validToDate);
        }
    }

    if (voucher.validFromDate) {
        voucher.validFromDate = new Date(voucher.validFromDate);
    }

    if (voucher.validToDate) {
        voucher.validToDate = new Date(voucher.validToDate);
    }


    return voucher;
};

exports.formatWalletDateFields = wallet => {
    if (wallet.walletAmountExpiryDate) {
        wallet.walletAmountExpiryDate = new Date(wallet.walletAmountExpiryDate);
    }

    if (wallet.validFromDate) {
        wallet.validFromDate = new Date(wallet.validFromDate);
    }

    if (wallet.validToDate) {
        wallet.validToDate = new Date(wallet.validToDate);
    }

    if (wallet.walletHolder && wallet.walletHolder.lastLoginDate) {
        wallet.walletHolder.lastLoginDate = new Date(wallet.walletHolder.lastLoginDate);
    }

    if (wallet.walletHolder && wallet.walletHolder.lastFailedLoginDate) {
        wallet.walletHolder.lastFailedLoginDate = new Date(wallet.walletHolder.lastFailedLoginDate);
    }

    return wallet;
};

exports.sendMessageToAzureBus = async (topic, message, context) => {
    if (topic && message) {
        const serviceBusClient = new ServiceBusClient(process.env.AZURE_BUS_CONNECTION_STRING);

        const sender = serviceBusClient.createSender(topic);

        const messages = { body: message, messageId: uuid.v4() };

        try {
            await sender.sendMessages(messages);
            if (context)
                context.log('Message sent');
            return true;
        } catch (error) {
            if (context)
                context.log(error);
            return false;
        }
    }
};

exports.sendMessageToAzureBusQueue = async (queueName, message, context) => {
    if (queueName && message) {
        const serviceBusClient = new ServiceBusClient(process.env.AZURE_BUS_CONNECTION_STRING);
        const sender = serviceBusClient.createSender(queueName);
        const sendMessage = JSON.stringify(message);
        const msg = {
            body: sendMessage,
            brokerProperties: { SessionId: SessionId },
            messageId: uuid.v4()
        };
        try {
            await sender.sendMessages(msg);
            if (context)
                context.log('Message sent');
            return true;
        } catch (error) {
            if (context)
                context.log(error);
            return false;
        }
    }
};

exports.sendMessagesToAzureBusQueue = (queueName, messages) => {
    messages.forEach(message => {
        this.sendMessageToAzureBusQueue(queueName, message);
    });
};

// exports.sendMessageToQueue = (queue, message) => {
//     if (queue && message) {
//         return new Promise((resolve, reject) => {
//             queueService.createMessageAsync(queue, JSON.stringify(message), null, (error, result) => {
//                 if (error) {
//                     console.log(error);
//                     reject(error);
//                 } else {
//                     console.log('Message sent to Queue');
//                     resolve(result);
//                 }
//             });
//         });
//     }
// };

// exports.getBlobList = (id) => {
//     return new Promise((resolve, reject) => {
//         blobService.listBlobsSegmentedWithPrefix(process.env.BLOB_CONTAINER, 'Voucher_' + id, null, (err, result) => {
//             if (err) {
//                 console.log('blobs not found');
//                 reject(err);
//             } else {
//                 console.log(result.entries);
//                 resolve(result.entries);
//             }
//         });
//     });
// };

// exports.deleteBlobList = (blobResult) => {
//     const blobRequestArray = new Array();
//     if (Array.isArray(blobResult)) {
//         blobResult.forEach(element => {
//             const req = new Promise((resolve, reject) => {
//                 blobService.deleteBlobIfExists(process.env.BLOB_CONTAINER, element.name, (error) => {
//                     if (error) {
//                         reject(error);
//                     } else {
//                         resolve(true);
//                     }
//                 });
//             });
//             blobRequestArray.push(req);
//         });

//     }
//     Promise.all(blobRequestArray);
// };

exports.deleteBlob = async (id) => {
    var connString = process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(connString);
    const containerName = process.env.BLOB_CONTAINER;
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const iter = containerClient.listBlobsFlat();
    let blobItem = await iter.next();
    while (!blobItem.done) {
        if (blobItem.value.name.includes('Voucher_' + id)) {
            
            containerClient.deleteBlob(blobItem.value.name);
        }
        blobItem = await iter.next();
    }
};
exports.sendRedemptionMessageToAzureBus = async (topic, message, context) => {
    if (topic && message) {
        const serviceBusClient = new ServiceBusClient(process.env.AZURE_BUS_CONNECTION_STRING);

        const sender = serviceBusClient.createSender(topic);

        const messages = { body: message, messageId: uuid.v4() };
        try {
            await sender.sendMessages(messages);
            if (context)
                context.log('Message sent');
            return true;
        } catch (error) {
            if (context)
                context.log(error);
            return false;
        }
        
    } else {
        Promise.resolve(false);
    }
};

exports.voucherLog = (voucher, merchant, err) => {
    const voucherLogMessage = {};
    voucherLogMessage._id = uuid.v4();
    voucherLogMessage.docType = 'voucherLog';
    voucherLogMessage.partitionKey = voucher._id;
    voucherLogMessage.voucherID = voucher._id;
    voucherLogMessage.voucherName = voucher.voucherTitle;
    voucherLogMessage.actionText = 'Redemption failed';
    voucherLogMessage.actionCode = 'redemptionfailed';
    if (merchant) {
        voucherLogMessage.merchantName = merchant.merchantName;
        voucherLogMessage.merchantID = merchant._id;
    }
    voucherLogMessage.result = err.message;
    voucherLogMessage.statusText = err.name;
    voucherLogMessage.statusCode = err.code;
    voucherLogMessage.createdDate = new Date();
    voucherLogMessage.updatedDate = new Date();
    if (!voucherLogMessage.merchantID && !voucherLogMessage.merchantName) {
        voucherLogMessage.merchantID = voucher.issuer.merchantID;
        voucherLogMessage.merchantName = voucher.issuer.merchantName;
    }
    return voucherLogMessage;
};

exports.updateVoucher = (from, to, reduced, increased, voucherCollections) => {

    if (from) {
        var updateQuery1 = voucherCollections.updateOne({
            _id: from._id,
            docType: 'balanceAccount',
            partitionKey: from._id
        }, {
            $set: {
                balanceAmount: reduced
            }
        });
    }

    if (to) {
        var updateQuery2 = voucherCollections.updateOne({
            _id: to._id,
            docType: 'balanceAccount',
            partitionKey: to._id
        }, {
            $set: {
                balanceAmount: increased
            }
        });
    }
    const requestUpdate = new Array();
    requestUpdate.push(updateQuery1, updateQuery2);
    return Promise.all(requestUpdate);

};

exports.updateTransactionDoc = (balanceAccountTransaction, status, voucherCollections, fromBalanceAccountIntialAmount = null,toBalanceAccountIntialAmount = null) => {

    const updateQuery1 = voucherCollections.updateOne({
        _id: balanceAccountTransaction._id,
        docType: 'balanceAccountTransactions',
        partitionKey: balanceAccountTransaction._id
    }, {
        $set: {
            fromBalanceAccountIntialAmount: fromBalanceAccountIntialAmount,
            toBalanceAccountIntialAmount: toBalanceAccountIntialAmount,
            transactionStatus: status
        }
    });

    return Promise.resolve(updateQuery1);

};
