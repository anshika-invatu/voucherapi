'use strict';

const utils = require('../utils');
const uuid = require('uuid');
const { getMongodbCollection } = require('../db/mongodb');
const { CustomLogs } = utils;

//Please refer the bac-174,205, 378 for further details

module.exports = function (context, mySbMsg) {
    CustomLogs(`voucher _id = ${mySbMsg._id} having event = ${mySbMsg.event}`,context);
    let voucherCollections;
    let isPendingTransactionAvailiable = false;
    const nonPendingTransactions = new Array();
    return getMongodbCollection('Vouchers')
        .then(collection => {
            voucherCollections = collection;
        })
        .then(()=>{
            let partnerNetworkID;
            if (!mySbMsg.settlementList) {
                return Promise.resolve();
            }
            const settlementTransactions = mySbMsg.settlementList.settlementTransactions;
            const reqSettlementList = {};
            reqSettlementList.voucherID = mySbMsg._id;
            reqSettlementList.settlementList = mySbMsg.settlementList;
            utils.logInfo(reqSettlementList);
            settlementTransactions.forEach(element => {
                if (element.settlementStatus === 'pending') {
                    if (element.trigger === 'redemption') {
                        partnerNetworkID = element.partnerNetworkID;
                    }
                }
            });
            CustomLogs(`partnerNetworkID = ${partnerNetworkID}`,context);
            if (partnerNetworkID) {
                const filters = {
                    docType: 'partnerNetworks',
                    _id: partnerNetworkID,
                    partitionKey: partnerNetworkID
                };
                return voucherCollections.findOne(filters);
            } else {
                return undefined;
            }
        })
        .then(partnerNetworkDoc => {
            CustomLogs(`partnerNetworkDoc = ${JSON.stringify(partnerNetworkDoc)}`,context);
            if (mySbMsg && mySbMsg.docType === 'vouchers' && (mySbMsg.event === 'redemption' || mySbMsg.event === 'new')) {
                if (mySbMsg.settlementList && mySbMsg.settlementList.settlementTransactions && Array.isArray(mySbMsg.settlementList.settlementTransactions)) {
                    const settlementTransactions = mySbMsg.settlementList.settlementTransactions;
                    settlementTransactions.forEach(element => {
                        if (element.settlementStatus === 'pending') {
                            CustomLogs('Pending settlement exist',context);
                            isPendingTransactionAvailiable = true;
                            let newClearingTransactions = [];
                            if (element.trigger === 'redemption') {
                                newClearingTransactions = processRedemptionTransaction(mySbMsg, element,partnerNetworkDoc, context);
                            } else {
                                newClearingTransactions = processNonRedemptionTransaction(mySbMsg, element);
                            }
                            if (newClearingTransactions && Array.isArray(newClearingTransactions)) {
                                newClearingTransactions.forEach(element => {
                                    if (element.clearingAmount < 0) {
                                        element.clearingAmount = 0;
                                    }
                                    if (element.vatAmount < 0) {
                                        element.vatAmount = 0;
                                    }
                                });
                            }
                            utils.sendMessagesToAzureBusQueue(process.env.AZURE_BUS_QUEUE_CLEARING_TRANSACTIONS, newClearingTransactions);
                            CustomLogs('Clearing transaction sent to topic = ' + process.env.AZURE_BUS_QUEUE_CLEARING_TRANSACTIONS,context);
                        } else {
                            nonPendingTransactions.push(element);
                        }
                    });
                }
            }
        })
        .then(() => {
            if (isPendingTransactionAvailiable) {
                voucherCollections.updateOne({
                    _id: mySbMsg._id,
                    docType: 'vouchers',
                    partitionKey: mySbMsg.passToken
                }, { $set: { 'settlementList.settlementTransactions': nonPendingTransactions }});
            }
        })
        .catch(error => utils.handleError(context, error));
};

function processRedemptionTransaction (voucherMessage, settlementTransaction,partnerNetworkDoc, context) {
    CustomLogs(`Processing redemption transaction ${settlementTransaction._id}`,context);
    const ret = [];
    let totalComission = 0;

    try {
        if (goForPartnerNetworkClearingLogic(voucherMessage, settlementTransaction,partnerNetworkDoc,context)) { //check if  condition satisfy for PartnerNetworkClearingLogic
            if (partnerNetworkDoc && Array.isArray(partnerNetworkDoc.partnerNetworkMembers)) {
                const partnerNetworkMemberInfo = partnerNetworkDoc.partnerNetworkMembers.find(element => element.merchantID === settlementTransaction.merchantID);
                let commissionAmount = 0,percentValueOfComission = 0;
                if (!partnerNetworkMemberInfo.commissionAmount && !partnerNetworkMemberInfo.commissionPercent) {
                    if (partnerNetworkDoc.commissionAmount) {
                        commissionAmount = Number(partnerNetworkDoc.commissionAmount);
                    }
                    if (partnerNetworkDoc.commissionPercent) {
                        percentValueOfComission = Number(partnerNetworkDoc.commissionPercent) / 100 * settlementTransaction.settlementAmount;
                    }
                    totalComission = commissionAmount + percentValueOfComission;
                } else {
                    if (partnerNetworkMemberInfo.commissionAmount) {
                        commissionAmount = Number(partnerNetworkMemberInfo.commissionAmount);
                    }
                    if (partnerNetworkMemberInfo.commissionPercent) {
                        percentValueOfComission = Number(partnerNetworkMemberInfo.commissionPercent) / 100 * settlementTransaction.settlementAmount;
                    }
                    totalComission = commissionAmount + percentValueOfComission;
                }
            }
        }
        CustomLogs(`Total commission value = ${totalComission}`,context);
        if (totalComission) { // if totalComission is not zero then partner network clearing transaction doc will be created
            totalComission = Number(totalComission.toFixed(2));
            CustomLogs('PartnerNetworkClearingTransaction doc created',context);
            ret.push(createPartnerNetworkClearingTransaction(voucherMessage, settlementTransaction,totalComission));
        }
    } catch (error) {
        context.log.error(error);
        utils.logEvents(error.message);
        //utils.handleError(context, error);
    }

       
    if (settlementTransaction.isMultiFunctionVoucher) {
        CustomLogs(`redemptionCounter = ${voucherMessage.redemptionCounter}`,context);

        CustomLogs('SalesClearingTransactionMPV doc created',context);
        ret.push(createSalesClearingTransactionMPV(voucherMessage, settlementTransaction,totalComission));

        if (voucherMessage.reseller && voucherMessage.reseller.isResellerCommissionClearingDone === false && voucherMessage.redemptionCounter === 1) { // create this only if reseller not paid yet
            CustomLogs('ResellerClearingTransaction doc created',context);
            ret.push(createResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.reseller && voucherMessage.reseller.isResellerCommissionClearingDone === true && voucherMessage.redemptionCounter === 1) { // Make sure Vourity gets paid for the reseller commission
            CustomLogs('RedeemResellerClearingTransaction doc created',context);
            ret.push(createRedeemResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.reseller && (voucherMessage.salesPrice !== voucherMessage.settlementList.totalSettlementAmount) && voucherMessage.redemptionCounter === 1) {
            CustomLogs('DiffResellerClearingTransaction doc created',context);
            ret.push(createDiffResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.redemptionCounter === 1) { // create this clearing transaction once only
            CustomLogs('ServiceFeeClearingTransactionMPV doc created',context);
            ret.push(createServiceFeeClearingTransactionMPV(voucherMessage, settlementTransaction));
        }
    } else {
        //ret.push(createPurchaseClearingTransaction(voucherMessage, settlementTransaction));
        //Purchase trans is automatically coming from the Sales transaction - Hans comment 2019-03-25

        CustomLogs('SalesClearingTransaction doc created',context);
        ret.push(createSalesClearingTransaction(voucherMessage, settlementTransaction,totalComission));

        if (voucherMessage.reseller && voucherMessage.reseller.isResellerCommissionClearingDone === false && voucherMessage.redemptionCounter === 1) { // create this only if reseller not paid yet
            CustomLogs('ResellerClearingTransaction doc created',context);
            ret.push(createResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.reseller && voucherMessage.reseller.isResellerCommissionClearingDone === true && voucherMessage.redemptionCounter === 1) { // Make sure Vourity gets paid for the reseller commission
            CustomLogs('RedeemResellerClearingTransaction doc created',context);
            ret.push(createRedeemResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.reseller && (voucherMessage.salesPrice !== voucherMessage.settlementList.totalSettlementAmount) && voucherMessage.redemptionCounter === 1) {
            CustomLogs('DiffResellerClearingTransaction doc created',context);
            ret.push(createDiffResellerClearingTransaction(voucherMessage, settlementTransaction));
        }

        if (voucherMessage.redemptionCounter === 1) { // create this clearing transaction once only
            CustomLogs('ServiceFeeClearingTransaction doc created',context);
            ret.push(createServiceFeeClearingTransaction(voucherMessage, settlementTransaction));
        }
    }

    return ret;
}

function goForPartnerNetworkClearingLogic (voucherDoc,settlementTransaction,partnerNetworkDoc,context) {
    let returnFlag = false;
    CustomLogs(`Settlement transaction merchantID = ${settlementTransaction.merchantID}`,context);
    CustomLogs(`partnerNetworkDoc _id = ${partnerNetworkDoc._id}`,context);
    if (voucherDoc.issuer.merchantID !== settlementTransaction.merchantID) {
        if (partnerNetworkDoc && Array.isArray(partnerNetworkDoc.partnerNetworkMembers)) {
            const partnerNetworkMemberInfo = partnerNetworkDoc.partnerNetworkMembers.find(element => element.merchantID === settlementTransaction.merchantID);
            if  (partnerNetworkMemberInfo) {
                returnFlag = IsComissionFieldExist(partnerNetworkDoc,partnerNetworkMemberInfo);
            }
        }
    }
    CustomLogs(`Returned Flag = ${returnFlag}`,context);
    return returnFlag;
}

function IsComissionFieldExist (partnerNetworkDoc,partnerNetworkMemberInfo) {
    let returnFlag = true;
    if (!partnerNetworkMemberInfo.commissionAmount && !partnerNetworkMemberInfo.commissionPercent) { // this check is common for both "zero value and field existence"
        if (!partnerNetworkDoc.commissionAmount && !partnerNetworkDoc.commissionPercent) {
            returnFlag = false;
        }

    }
    return returnFlag;
}

function createPartnerNetworkClearingTransaction (voucherMessage,settlementTransaction,totalComission) {
  
    utils.logInfo(`Creating partner network clearing transaction for settlement transaction ${settlementTransaction._id}`);
    const partnerNetworkClearingTransaction = {};
    partnerNetworkClearingTransaction._id = uuid.v4();
    partnerNetworkClearingTransaction.docType = 'clearingTransaction';
    partnerNetworkClearingTransaction.partitionKey = partnerNetworkClearingTransaction._id;
    partnerNetworkClearingTransaction.transactionDate = new Date();
    partnerNetworkClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        partnerNetworkClearingTransaction.senderMerchantID = settlementTransaction.merchantID;
        partnerNetworkClearingTransaction.senderMerchantName = settlementTransaction.merchantName;
    }
    partnerNetworkClearingTransaction.receiverMerchantID =  voucherMessage.issuer.merchantID;
    partnerNetworkClearingTransaction.receiverMerchantName =  voucherMessage.issuer.merchantName;
    partnerNetworkClearingTransaction.clearingAmount = totalComission;
    partnerNetworkClearingTransaction.vatPercent = voucherMessage.serviceFee ? voucherMessage.serviceFee.vatPercent : null;
    if (partnerNetworkClearingTransaction.vatPercent) {
        partnerNetworkClearingTransaction.vatAmount = Number(Number(partnerNetworkClearingTransaction.clearingAmount - (partnerNetworkClearingTransaction.clearingAmount / ((partnerNetworkClearingTransaction.vatPercent / 100) + 1))).toFixed(2));
    }
    partnerNetworkClearingTransaction.currency = voucherMessage.currency;
    partnerNetworkClearingTransaction.vatClass = voucherMessage.serviceFee ? voucherMessage.serviceFee.vatClass : null;
    partnerNetworkClearingTransaction.trigger = 'redemptionPartnerNetwork';
    partnerNetworkClearingTransaction.category = 'revenues';
    partnerNetworkClearingTransaction.productClass = 'PartnerCommission';
    partnerNetworkClearingTransaction.productClassName = 'Partner Commission';
    partnerNetworkClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    partnerNetworkClearingTransaction.fromBalanceAccountID = voucherMessage.balanceAccountID;
    partnerNetworkClearingTransaction.toBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    partnerNetworkClearingTransaction.senderService = 'Vouchers API';
    partnerNetworkClearingTransaction.comment = 'Partner Network Commission clearing transaction';
    partnerNetworkClearingTransaction.createdDate = new Date();
    partnerNetworkClearingTransaction.updatedDate = new Date();
    partnerNetworkClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    if (partnerNetworkClearingTransaction.clearingAmount < 0) {
        partnerNetworkClearingTransaction.clearingAmount = 0;
        partnerNetworkClearingTransaction.vatAmount = 0;
    }
    if (partnerNetworkClearingTransaction.vatAmount < 0) {
        partnerNetworkClearingTransaction.vatAmount = 0;
    }
    return partnerNetworkClearingTransaction;
}

function createSalesClearingTransaction (voucherMessage, settlementTransaction,totalComission) {
    utils.logInfo(`Creating SPV sales clearing transaction for settlement transaction ${settlementTransaction._id}`);
    const revenueClearingTransaction = {};
    revenueClearingTransaction._id = uuid.v4();
    revenueClearingTransaction.docType = 'clearingTransaction';
    revenueClearingTransaction.partitionKey = revenueClearingTransaction._id;
    revenueClearingTransaction.transactionDate = new Date();
    revenueClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        revenueClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        revenueClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    revenueClearingTransaction.receiverMerchantID = settlementTransaction.merchantID;
    revenueClearingTransaction.receiverMerchantName = settlementTransaction.merchantName;

    // take upto 2 decimal places
    revenueClearingTransaction.clearingAmount = Number(settlementTransaction.settlementAmount) - totalComission;
    revenueClearingTransaction.clearingAmount = Number(revenueClearingTransaction.clearingAmount.toFixed(2));

    revenueClearingTransaction.vatPercent = settlementTransaction.vatPercent;
    revenueClearingTransaction.vatAmount = Number(Number(settlementTransaction.vatAmount).toFixed(2));
    revenueClearingTransaction.currency = settlementTransaction.currency;
    revenueClearingTransaction.vatClass = settlementTransaction.vatClass;
    revenueClearingTransaction.trigger = 'redemption';
    revenueClearingTransaction.category = 'revenues';
    revenueClearingTransaction.productClass = settlementTransaction.productClass;
    revenueClearingTransaction.productClassName = settlementTransaction.productClassName;
    revenueClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    revenueClearingTransaction.fromBalanceAccountID = settlementTransaction.fromBalanceAccountID;
    revenueClearingTransaction.toBalanceAccountID = settlementTransaction.toBalanceAccountID;
    revenueClearingTransaction.senderService = 'Vouchers API';
    revenueClearingTransaction.comment = 'Merchant SPV Sales transaction';
    revenueClearingTransaction.createdDate = new Date();
    revenueClearingTransaction.updatedDate = new Date();
    revenueClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return revenueClearingTransaction;
}

function createSalesClearingTransactionMPV (voucherMessage, settlementTransaction,totalComission) {
    utils.logInfo(`Creating MPV sales clearing transaction for settlement transaction ${settlementTransaction._id}`);
    const revenueClearingTransaction = {};
    revenueClearingTransaction._id = uuid.v4();
    revenueClearingTransaction.docType = 'clearingTransaction';
    revenueClearingTransaction.partitionKey = revenueClearingTransaction._id;
    revenueClearingTransaction.transactionDate = new Date();
    revenueClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        revenueClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        revenueClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    revenueClearingTransaction.receiverMerchantID = settlementTransaction.merchantID;
    revenueClearingTransaction.receiverMerchantName = settlementTransaction.merchantName;
    // take upto 2 decimal places
    revenueClearingTransaction.clearingAmount = Number(settlementTransaction.settlementAmount) - totalComission;
    revenueClearingTransaction.clearingAmount = Number(revenueClearingTransaction.clearingAmount.toFixed(2));

    revenueClearingTransaction.vatPercent = settlementTransaction.vatPercent;
    revenueClearingTransaction.vatAmount = Number(Number(settlementTransaction.vatAmount).toFixed(2));
    revenueClearingTransaction.currency = settlementTransaction.currency;
    revenueClearingTransaction.vatClass = settlementTransaction.vatClass;
    revenueClearingTransaction.trigger = 'redemption';
    revenueClearingTransaction.category = 'revenues';
    revenueClearingTransaction.productClass = settlementTransaction.productClass;
    revenueClearingTransaction.productClassName = settlementTransaction.productClassName;
    revenueClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    revenueClearingTransaction.fromBalanceAccountID = settlementTransaction.fromBalanceAccountID;
    revenueClearingTransaction.toBalanceAccountID = settlementTransaction.toBalanceAccountID;
    revenueClearingTransaction.senderService = 'Vouchers API';
    revenueClearingTransaction.comment = 'Merchant MPV Sales transaction';
    revenueClearingTransaction.createdDate = new Date();
    revenueClearingTransaction.updatedDate = new Date();
    revenueClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return revenueClearingTransaction;
}

function createServiceFeeClearingTransaction (voucherMessage, settlementTransaction) {
    utils.logInfo(`Creating service fee clearing transaction for settlement transaction ${settlementTransaction._id}`);

    const serviceFeeClearingTransaction = {};
    serviceFeeClearingTransaction._id = uuid.v4();
    serviceFeeClearingTransaction.docType = 'clearingTransaction';
    serviceFeeClearingTransaction.partitionKey = serviceFeeClearingTransaction._id;
    serviceFeeClearingTransaction.transactionDate = new Date();
    serviceFeeClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        serviceFeeClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        serviceFeeClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    serviceFeeClearingTransaction.receiverMerchantID = process.env.VOURITY_MERCHANT_ID;
    serviceFeeClearingTransaction.receiverMerchantName = 'Vourity AB';
    serviceFeeClearingTransaction.clearingAmount = calculateClearingAmount(voucherMessage);
    serviceFeeClearingTransaction.vatPercent = voucherMessage.serviceFee.vatPercent;
    serviceFeeClearingTransaction.vatAmount = Number(Number(serviceFeeClearingTransaction.clearingAmount - (serviceFeeClearingTransaction.clearingAmount / ((voucherMessage.serviceFee.vatPercent / 100) + 1))).toFixed(2));
    serviceFeeClearingTransaction.currency = settlementTransaction.currency;
    serviceFeeClearingTransaction.vatClass = voucherMessage.serviceFee.vatClass;
    serviceFeeClearingTransaction.trigger = 'redemption';
    serviceFeeClearingTransaction.category = 'costs';
    serviceFeeClearingTransaction.productClass = voucherMessage.serviceFee.productClass;
    serviceFeeClearingTransaction.productClassName = voucherMessage.serviceFee.productClassName;
    serviceFeeClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    serviceFeeClearingTransaction.fromBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    serviceFeeClearingTransaction.toBalanceAccountID = voucherMessage.merchantVourity.balanceAccountID;
    serviceFeeClearingTransaction.senderService = 'Vouchers API';
    serviceFeeClearingTransaction.comment = 'Service fee';
    serviceFeeClearingTransaction.createdDate = new Date();
    serviceFeeClearingTransaction.updatedDate = new Date();
    serviceFeeClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return serviceFeeClearingTransaction;
}

function createServiceFeeClearingTransactionMPV (voucherMessage, settlementTransaction) {
    utils.logInfo(`Creating service fee clearing transaction for MPV settlement transaction ${settlementTransaction._id}`);

    const serviceFeeClearingTransaction = {};
    serviceFeeClearingTransaction._id = uuid.v4();
    serviceFeeClearingTransaction.docType = 'clearingTransaction';
    serviceFeeClearingTransaction.partitionKey = serviceFeeClearingTransaction._id;
    serviceFeeClearingTransaction.transactionDate = new Date();
    serviceFeeClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        serviceFeeClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        serviceFeeClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    serviceFeeClearingTransaction.receiverMerchantID = process.env.VOURITY_MERCHANT_ID;
    serviceFeeClearingTransaction.receiverMerchantName = 'Vourity AB';
    serviceFeeClearingTransaction.clearingAmount = calculateClearingAmount(voucherMessage);
    serviceFeeClearingTransaction.vatPercent = voucherMessage.serviceFee.vatPercent;
    serviceFeeClearingTransaction.vatAmount = Number(Number(serviceFeeClearingTransaction.clearingAmount - (serviceFeeClearingTransaction.clearingAmount / ((voucherMessage.serviceFee.vatPercent / 100) + 1))).toFixed(2));
    serviceFeeClearingTransaction.currency = settlementTransaction.currency;
    serviceFeeClearingTransaction.vatClass = voucherMessage.serviceFee.vatClass;
    serviceFeeClearingTransaction.trigger = 'redemption';
    serviceFeeClearingTransaction.category = 'costs';
    serviceFeeClearingTransaction.productClass = voucherMessage.serviceFee.productClass;
    serviceFeeClearingTransaction.productClassName = voucherMessage.serviceFee.productClassName;
    serviceFeeClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    serviceFeeClearingTransaction.fromBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    serviceFeeClearingTransaction.toBalanceAccountID = voucherMessage.merchantVourity.balanceAccountID;
    serviceFeeClearingTransaction.senderService = 'Vouchers API';
    serviceFeeClearingTransaction.comment = 'Service fee';
    serviceFeeClearingTransaction.createdDate = new Date();
    serviceFeeClearingTransaction.updatedDate = new Date();
    serviceFeeClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return serviceFeeClearingTransaction;
}

function createRedeemResellerClearingTransaction (voucherMessage, settlementTransaction) {
    utils.logInfo(`Creating Redeem Reseller clearing transaction ${settlementTransaction._id}`);
    let resellerAmount;

    if (voucherMessage.reseller.resellerCommissionPercent && !voucherMessage.reseller.resellerCommissionAmount) {
        resellerAmount = (voucherMessage.salesPrice * voucherMessage.reseller.resellerCommissionPercent) / 100;
    }

    if (voucherMessage.reseller.resellerCommissionAmount && !voucherMessage.reseller.resellerCommissionPercent) {
        resellerAmount = voucherMessage.reseller.resellerCommissionAmount;
    }

    if (voucherMessage.reseller.resellerCommissionPercent && voucherMessage.reseller.resellerCommissionAmount) {
        resellerAmount = ((voucherMessage.salesPrice * voucherMessage.reseller.resellerCommissionPercent) / 100) + voucherMessage.reseller.resellerCommissionAmount;
    }

    const resellerClearingTransaction = {};
    resellerClearingTransaction._id = uuid.v4();
    resellerClearingTransaction.docType = 'clearingTransaction';
    resellerClearingTransaction.partitionKey = resellerClearingTransaction._id;
    resellerClearingTransaction.transactionDate = new Date();
    resellerClearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        resellerClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        resellerClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    resellerClearingTransaction.receiverMerchantID = process.env.VOURITY_MERCHANT_ID;
    resellerClearingTransaction.receiverMerchantName = 'Vourity AB';
    resellerClearingTransaction.clearingAmount = Number(resellerAmount);
    resellerClearingTransaction.vatPercent = voucherMessage.reseller.vatPercent;
    resellerClearingTransaction.vatAmount = Number(Number(resellerAmount - (resellerAmount / ((voucherMessage.reseller.vatPercent / 100) + 1))).toFixed(2));
    resellerClearingTransaction.currency = voucherMessage.reseller.currency;
    resellerClearingTransaction.vatClass = voucherMessage.reseller.vatClass;
    resellerClearingTransaction.trigger = 'redemption';
    resellerClearingTransaction.category = 'costs';
    resellerClearingTransaction.productClass = voucherMessage.reseller.productClass;
    resellerClearingTransaction.productClassName = voucherMessage.reseller.productClassName;
    resellerClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    resellerClearingTransaction.fromBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    resellerClearingTransaction.toBalanceAccountID = voucherMessage.merchantVourity.balanceAccountID;
    resellerClearingTransaction.senderService = 'Vouchers API';
    resellerClearingTransaction.comment = 'Reseller redemption commission clearing transaction';
    resellerClearingTransaction.createdDate = new Date();
    resellerClearingTransaction.updatedDate = new Date();
    resellerClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return resellerClearingTransaction;
}

function createResellerClearingTransaction (voucherMessage, settlementTransaction) {
    utils.logInfo(`Creating Reseller clearing transaction for settlement transaction ${settlementTransaction._id}`);
    let resellerAmount;

    if (voucherMessage.reseller.resellerCommissionPercent && !voucherMessage.reseller.resellerCommissionAmount) {
        resellerAmount = (voucherMessage.salesPrice * voucherMessage.reseller.resellerCommissionPercent) / 100;
    }

    if (voucherMessage.reseller.resellerCommissionAmount && !voucherMessage.reseller.resellerCommissionPercent) {
        resellerAmount = voucherMessage.reseller.resellerCommissionAmount;
    }

    if (voucherMessage.reseller.resellerCommissionPercent && voucherMessage.reseller.resellerCommissionAmount) {
        resellerAmount = ((voucherMessage.salesPrice * voucherMessage.reseller.resellerCommissionPercent) / 100) + voucherMessage.reseller.resellerCommissionAmount;
    }

    const resellerClearingTransaction = {};
    resellerClearingTransaction._id = uuid.v4();
    resellerClearingTransaction.docType = 'clearingTransaction';
    resellerClearingTransaction.partitionKey = resellerClearingTransaction._id;
    resellerClearingTransaction.transactionDate = new Date();
    resellerClearingTransaction.transactionStatus = 'pending';

    if (voucherMessage.issuer) {
        resellerClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        resellerClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }

    if (voucherMessage.reseller) {
        resellerClearingTransaction.receiverMerchantID = voucherMessage.reseller.merchantID;
        resellerClearingTransaction.receiverMerchantName = voucherMessage.reseller.merchantName;
    }

    resellerClearingTransaction.clearingAmount = Number(resellerAmount);
    resellerClearingTransaction.vatPercent = voucherMessage.reseller.vatPercent;
    resellerClearingTransaction.vatAmount = Number(Number(resellerAmount - (resellerAmount / ((voucherMessage.reseller.vatPercent / 100) + 1))).toFixed(2));
    resellerClearingTransaction.currency = voucherMessage.reseller.currency;
    resellerClearingTransaction.vatClass = voucherMessage.reseller.vatClass;
    resellerClearingTransaction.trigger = 'redemptionResellerCommission';
    resellerClearingTransaction.category = 'costs';
    resellerClearingTransaction.productClass = voucherMessage.reseller.productClass;
    resellerClearingTransaction.productClassName = voucherMessage.reseller.productClassName;
    resellerClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    resellerClearingTransaction.fromBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    resellerClearingTransaction.toBalanceAccountID = voucherMessage.reseller.balanceAccountID;
    resellerClearingTransaction.senderService = 'Vouchers API';
    resellerClearingTransaction.comment = 'Reseller commission clearing transaction';
    resellerClearingTransaction.createdDate = new Date();
    resellerClearingTransaction.updatedDate = new Date();
    resellerClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return resellerClearingTransaction;
}

function createDiffResellerClearingTransaction (voucherMessage, settlementTransaction) {
    utils.logInfo(`Creating Diff Reseller clearing transaction ${settlementTransaction._id}`);
    let resellerAmount;

    resellerAmount = 0;
    resellerAmount = voucherMessage.salesPrice - voucherMessage.settlementList.totalSettlementAmount;

    const resellerClearingTransaction = {};
    resellerClearingTransaction._id = uuid.v4();
    resellerClearingTransaction.docType = 'clearingTransaction';
    resellerClearingTransaction.partitionKey = resellerClearingTransaction._id;
    resellerClearingTransaction.transactionDate = new Date();
    resellerClearingTransaction.transactionStatus = 'pending';

    if (voucherMessage.issuer) {
        resellerClearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        resellerClearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }

    if (voucherMessage.reseller) {
        resellerClearingTransaction.receiverMerchantID = voucherMessage.reseller.merchantID;
        resellerClearingTransaction.receiverMerchantName = voucherMessage.reseller.merchantName;
    }

    resellerClearingTransaction.clearingAmount = Number(resellerAmount);
    resellerClearingTransaction.vatPercent = voucherMessage.reseller.vatPercent;
    resellerClearingTransaction.vatAmount = Number(Number(resellerAmount - (resellerAmount / ((voucherMessage.reseller.vatPercent / 100) + 1))).toFixed(2));
    resellerClearingTransaction.currency = voucherMessage.reseller.currency;
    resellerClearingTransaction.vatClass = voucherMessage.reseller.vatClass;
    resellerClearingTransaction.trigger = 'redemptionResellerCommission';
    resellerClearingTransaction.category = 'revenues';
    resellerClearingTransaction.productClass = voucherMessage.reseller.productClass;
    resellerClearingTransaction.productClassName = voucherMessage.reseller.productClassName;
    resellerClearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    resellerClearingTransaction.fromBalanceAccountID = voucherMessage.issuer.balanceAccountID;
    resellerClearingTransaction.toBalanceAccountID = voucherMessage.reseller.balanceAccountID;
    resellerClearingTransaction.senderService = 'Vouchers API';
    resellerClearingTransaction.comment = 'Reseller diff commission clearing transaction';
    resellerClearingTransaction.createdDate = new Date();
    resellerClearingTransaction.updatedDate = new Date();
    resellerClearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return resellerClearingTransaction;
}

function calculateClearingAmount (voucher) {
    if (voucher.serviceFee) {
        if (voucher.serviceFee.feePerTransactionPercent && voucher.serviceFee.feePerTransactionAmount) {
            return voucher.salesPrice * (voucher.serviceFee.feePerTransactionPercent / 100) + voucher.serviceFee.feePerTransactionAmount;
        } else if (voucher.serviceFee.feePerTransactionPercent) {
            return voucher.salesPrice * (voucher.serviceFee.feePerTransactionPercent / 100);
        } else if (voucher.serviceFee.feePerTransactionAmount) {
            return Number(voucher.serviceFee.feePerTransactionAmount);
        } else {
            return 0;
        }
    } else {
        return 0;
    }
}

function processNonRedemptionTransaction (voucherMessage, settlementTransaction) {
    const clearingTransaction = {};
    clearingTransaction._id = uuid.v4();
    clearingTransaction.partitionKey = clearingTransaction._id;
    clearingTransaction.docType = 'clearingTransaction';
    clearingTransaction.settlementTransactionID = settlementTransaction.settlementTransactionID;
    clearingTransaction.transactionDate = new Date();
    clearingTransaction.transactionStatus = 'pending';
    if (voucherMessage.issuer) {
        clearingTransaction.senderMerchantID = voucherMessage.issuer.merchantID;
        clearingTransaction.senderMerchantName = voucherMessage.issuer.merchantName;
    }
    clearingTransaction.receiverMerchantID = settlementTransaction.merchantID;
    clearingTransaction.receiverMerchantName = settlementTransaction.merchantName;
    clearingTransaction.clearingAmount = Number(settlementTransaction.settlementAmount);
    clearingTransaction.vatPercent = settlementTransaction.vatPercent;
    clearingTransaction.vatAmount = Number(Number(settlementTransaction.vatAmount).toFixed(2));
    clearingTransaction.currency = settlementTransaction.currency;
    clearingTransaction.vatClass = settlementTransaction.vatClass;
    clearingTransaction.trigger = settlementTransaction.trigger;
    clearingTransaction.category = 'revenues';
    clearingTransaction.fromBalanceAccountID = settlementTransaction.fromBalanceAccountID;
    clearingTransaction.toBalanceAccountID = settlementTransaction.toBalanceAccountID;
    clearingTransaction.productClass = settlementTransaction.productClass;
    clearingTransaction.productClassName = settlementTransaction.productClassName;
    clearingTransaction.isMultiFunctionVoucher = settlementTransaction.isMultiFunctionVoucher;
    clearingTransaction.senderService = 'Vouchers API';
    clearingTransaction.comment = 'Non redemption transaction';
    clearingTransaction.createdDate = new Date();
    clearingTransaction.updatedDate = new Date();
    clearingTransaction.references = {
        voucherID: voucherMessage._id,
        voucherPartitionKey: voucherMessage.partitionKey,
        settlementTransactionID: settlementTransaction.settlementTransactionID,
        orderID: voucherMessage.orderID
    };
    return [clearingTransaction];
}