'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const { getMongodbCollectionRegional } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');
const uuid = require('uuid');
const moment = require('moment');
const xss = require('xss'); // for cross side scripting
const request = require('request-promise');
const emailNotification = require('../spec/sample-docs/Notification');
const walletInbox = require('../spec/sample-docs/WalletInbox');
const samplePass = require('../spec/sample-docs/Passes');

//The endpoint should take parameters fromWalletID this is the sender,
// and then either toWalletID or toEmail so we can send the pass either to a receiver based on walletID or an e-mail address and of course the voucherID of the Voucher to send.
//Please refer the story bac-61, 247, 259, 260, 430 for more details

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You have requested to send voucher however request body seems to be empty',
                400
            )
        );
        return Promise.resolve();
    }
    var vouchersCollection;
    let walletsCollection;
    let passesCollection;
    let receiverWallet;
    let senderWallet;
    let receiverPassToken;
    var isError = false;
    var oldvoucher;
    return utils.validateUUIDField(context, req.body.fromWalletID, 'The fromWalletID specified in the body does not match the UUID v4 format.')
        .then(() => utils.validateUUIDField(context, req.body.voucherID, 'The voucherID specified in the body does not match the UUID v4 format.'))
        .then(() => getMongodbCollectionRegional('Wallets'))
        .then(collection => {    //Get sender wallet
            walletsCollection = collection;
            return collection.findOne({
                _id: req.body.fromWalletID,
                docType: 'wallets',
                partitionKey: req.body.fromWalletID
            });
        })
        .then(result => {   // Get receiver wallet
            if (result) {
                var query = [];
                if (req.body.toWalletID) {
                    query.push({ _id: req.body.toWalletID });
                    query.push({ partitionKey: req.body.toWalletID });
                }
                if (req.body.toEmail) {
                    query.push({ email: req.body.toEmail });
                }
                if (req.body.toVourityID) {
                    query.push({ vourityID: req.body.toVourityID });
                }
                senderWallet = result;
                return walletsCollection.findOne({
                    $or: query,
                    docType: 'wallets'
                });
            } else if (!result) {
                isError = true;
                utils.setContextResError(
                    context,
                    new errors.WalletNotFoundError(
                        'The fromWalletID specified in the body doesn\'t exist.',
                        404
                    )
                );
                return Promise.resolve();
            }
        })
        .then(result => {
            if (result) {
                return result;
            } else if (!isError) {
                if (req.body.toEmail) {
                    const body = {
                        _id: uuid.v4(),
                        walletName: 'My Wallet',
                        docType: 'wallets',
                        walletDescription: 'Keeping all your Passes and Vouchers',
                        isEnabled: true,
                        isLocked: false,
                        validFromDate: new Date(),
                        validToDate: moment()
                            .add(20, 'years')
                            .toDate(),
                        email: req.body.toEmail,
                        sendNotifications: {
                            viaEmail: true,
                            viaSMS: false,
                            onVoucherRedeemed: true,
                            onVoucherViewed: true,
                            onVoucherTransfered: false,
                            onPassTransfered: true
                        },
                        walletAmount: 0,
                        currency: 'VOC'
                    };
                    const url = `${process.env.WALLET_API_URL}/api/${process.env.WALLET_API_VERSION}/wallets`;
                    return request.post(url, {
                        headers: {
                            'x-functions-key': process.env.WALLET_API_KEY
                        },
                        json: true,
                        body
                    });
                } else {
                    isError = true;
                    utils.setContextResError(
                        context,
                        new errors.WalletNotFoundError(
                            'The receiver wallet not found with toWalletID or toVourityID specified in the body',
                            404
                        )
                    );
                }

            }
        })
        .then(result => {
            if (result && !isError) {
                receiverWallet = result;
                return getMongodbCollection('Passes');
            }
        })
        .then(result => { //Get default pass
            if (result) {
                passesCollection = result;
                if (receiverWallet.defaultPassID) {
                    return result.findOne({
                        _id: receiverWallet.defaultPassID,
                        docType: 'passes',
                        partitionKey: receiverWallet.defaultPassID
                    });
                }
            }
        })
        .then(result => { // Create new pass for receiver
            if (!isError) {
                if (result) {
                    receiverPassToken = result.passToken;
                    return result;
                } else {
                    samplePass._id = uuid.v4();
                    samplePass.partitionKey = samplePass._id;
                    samplePass.createdDate = new Date();
                    samplePass.updatedDate = new Date();
                    samplePass.passTitle = 'My Default Pass';
                    samplePass.passDescription = 'Your default Pass';
                    samplePass.passToken = uuid.v4();
                    samplePass.imageURL = process.env.PASS_DEFAULT_IMAGE_URL;
                    samplePass.walletID = receiverWallet._id;
                    receiverWallet.defaultPassID = samplePass._id;
                    return passesCollection.insertOne(samplePass);
                }
            }
        })
        .then(result => { //Set receiverPassToken
            if (result && result.ops && result.ops[0]) {
                receiverPassToken = samplePass.passToken;
            }
            return getMongodbCollection('Vouchers');
        })
        .then(result => { // Update vouchers with new passToken
            if (result) {
                vouchersCollection = result;
                return vouchersCollection.findOne({ _id: req.body.voucherID, docType: 'vouchers' });
            }
        })
        .then((result) => {
            if (result) {
                oldvoucher = result;
                const voucher = Object.assign(
                    {},
                    result,
                    {
                        _id: uuid.v4(),
                        voucherToken: uuid.v4(),
                        passToken: utils.hashToken(receiverPassToken),
                        partitionKey: utils.hashToken(receiverPassToken),
                        notificationSubscribers: [{
                            walletID: receiverWallet._id,
                            events: 'all'
                        }],
                        updatedDate: new Date()
                    }
                );
                return vouchersCollection.insertOne(voucher);
            }
        })
        .then(result => {
            if (result) {
                return vouchersCollection.deleteOne({ _id: oldvoucher._id, docType: 'vouchers', partitionKey: oldvoucher.passToken });
            }
        })
        .then(result => { //Create email notification
            if (!isError) {
                if (result && result.deletedCount === 1) {
                    var notificationMessge = Object.assign({}, emailNotification);
                    notificationMessge._id = uuid.v4();
                    notificationMessge.notificationType = 'email';
                    notificationMessge.receiver.walletID = receiverWallet._id;
                    notificationMessge.isSent = true;
                    notificationMessge.messageSubject = 'You have received a new Voucher';
                    notificationMessge.sentDate = new Date();
                    notificationMessge.createdDate = new Date();
                    notificationMessge.updatedDate = new Date();
                    notificationMessge.template = 'new-voucher';
                    notificationMessge.templateFields = {
                        url: process.env.VIEW_PASS_URL + receiverPassToken
                    };
                    if (req.body.message) {
                        const message = xss(req.body.message);
                        if (message) {
                            notificationMessge.templateFields.message = message;
                        }
                    }
                    utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_NOTIFICATION_EMAIL, notificationMessge);
                    return walletsCollection.findOne({
                        walletID: receiverWallet._id,
                        docType: 'walletInbox'
                    });
                } else {
                    isError = true;
                    utils.setContextResError(
                        context,
                        new errors.VoucherNotFoundError(
                            'The voucher id specified in the body doesn\'t exist.',
                            404
                        )
                    );
                }
            }
        })
        .then(result => {   // Update or create walletInbox
            if (!isError) {
                if (result) {
                    const inbox = {
                        messageSubject: 'You have received a new Voucher',
                        messageBody: 'You have received a new Voucher',
                        sender: {
                            walletID: senderWallet._id
                        },
                        receivedDate: new Date()
                    };
                    if (result.inbox && Array.isArray(result.inbox)) {
                        result.inbox.push(inbox);
                    } else {
                        result.inbox = [inbox];
                    }
                    return walletsCollection.updateOne({
                        walletID: result.walletID,
                        docType: 'walletInbox',
                        partitionKey: result.walletID
                    }, {
                        $set: Object.assign(
                            {},
                            result,
                            {
                                inbox: result.inbox,
                                updatedDate: new Date()
                            }
                        )
                    });
                } else if (!result && receiverWallet) {
                    result = Object.assign({}, walletInbox);
                    result._id = uuid.v4();
                    result.walletID = receiverWallet._id;
                    result.partitionKey = receiverWallet._id;
                    const message = {
                        messageSubject: 'You have received a new Voucher',
                        messageBody: 'You have received a new Voucher',
                        sender: {
                            walletID: senderWallet._id
                        },
                        receivedDate: new Date()
                    };
                    result.inbox = [];
                    result.inbox.push(message);
                    result.createdDate = new Date();
                    result.updatedDate = new Date();
                    return walletsCollection.insertOne(result);
                }
            }
        })
        .then(result => {
            if (!isError && result) {
                return walletsCollection.updateOne({
                    _id: receiverWallet._id,
                    docType: 'wallets',
                    partitionKey: receiverWallet._id
                }, {
                    $set: {
                        defaultPassID: receiverWallet.defaultPassID
                    }
                });
            }
        })
        .then(result => {
            if (!isError && result && result.matchedCount) {
                context.res = {
                    body: {
                        code: 200,
                        description: 'Voucher sent successfully to receiver wallet'
                    }
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
