'use strict';

const errors = require('../errors');
const uuid = require('uuid');
const settlementTransactionID = uuid.v4();
const sampleRedemption = require('../spec/sample-docs/Redemption');



exports.getRedemptionFields = (voucherValue, redemptionsCount) => {
    redemptionsCount = redemptionsCount || 1;
    let isRedeemed = false;
    if ((voucherValue.redemptionsLeft || voucherValue.redemptionsLeft === 0) && (voucherValue.spend || voucherValue.spend === 0)) {
        if (voucherValue.redemptionsLeft >= voucherValue.spend) {
            let redemptionsLeft = voucherValue.redemptionsLeft
                - (voucherValue.spend * redemptionsCount);

            if (redemptionsLeft <= 0) {
                isRedeemed = true;
                redemptionsLeft = 0;
            }
            voucherValue.redemptionsLeft = redemptionsLeft;
        } else {
            throw new errors.NoRedemptionsLeftError(
                'The voucher you have requested to redeem has no redemptions left.',
                400
            );
        }
    }

    return isRedeemed;
};

exports.updateVoucher = (voucher, isRedeemed, updatedVoucherValue, collection, merchant, balanceAccountID, redemptionCost, partnerNetwork) => {
    
    const settlementTransaction = {};
    if (voucher.redemptionCounter) {
        voucher.redemptionCounter = voucher.redemptionCounter + 1;
    } else {
        voucher.redemptionCounter = 1;
    }
    voucher.event = 'redemption';
    if (!voucher.settlementList) {
        voucher.settlementList = {};
    }
    if (!voucher.settlementList.settlementTransactions || !Array.isArray(voucher.settlementList.settlementTransactions)) {
        voucher.settlementList.settlementTransactions = new Array();
    }

    let merchantSettlementAmount = 0;

    const settlementList = voucher.settlementList;

    if (settlementList.totalSettlementAmountLeft <= 0) {
        merchantSettlementAmount = 0;
    } else if (settlementList.totalSettlementAmountLeft > 0 && settlementList.settleValueOnRedemption === 'fullonfirstredemption') {
        merchantSettlementAmount = redemptionCost;
        settlementList.totalSettlementAmountLeft = 0;
    } else if (settlementList.totalSettlementAmountLeft > 0 && settlementList.settleValueOnRedemption !== 'fullonfirstredemption' && settlementList.totalSettlementAmountLeft >= redemptionCost) {
        merchantSettlementAmount = redemptionCost;
        settlementList.totalSettlementAmountLeft = settlementList.totalSettlementAmountLeft - redemptionCost;
    } else if (settlementList.totalSettlementAmountLeft > 0 && settlementList.settleValueOnRedemption !== 'fullonfirstredemption' && settlementList.totalSettlementAmountLeft < redemptionCost) {
        merchantSettlementAmount = settlementList.totalSettlementAmountLeft;
        settlementList.totalSettlementAmountLeft = 0;
    }


    if (merchant) {
        settlementTransaction.merchantID = merchant._id;
        settlementTransaction.merchantName = merchant.merchantName;
        settlementTransaction.toBalanceAccountID = balanceAccountID;
    } else {
        settlementTransaction.merchantID = voucher.issuer.merchantID;
        settlementTransaction.merchantName = voucher.issuer.merchantName;
        settlementTransaction.toBalanceAccountID = voucher.issuer.balanceAccountID;
    }
    settlementTransaction.settlementTransactionID = settlementTransactionID;
    settlementTransaction.merchantType = 'collector';
    settlementTransaction.currency = voucher.currency;
    settlementTransaction.fromBalanceAccountID = voucher.balanceAccountID;
    settlementTransaction.settlementStatus = 'pending';
    settlementTransaction.settlementAmount = Number(merchantSettlementAmount);
    settlementTransaction.productClass = voucher.productClass;
    settlementTransaction.productClassName = voucher.productClassName;
    settlementTransaction.vatPercent = voucher.vatPercent;
    settlementTransaction.vatClass = voucher.vatClass;
    settlementTransaction.trigger = 'redemption';
    settlementTransaction.isMultiFunctionVoucher = voucher.isMultiFunctionVoucher;
    if (partnerNetwork) {
        settlementTransaction.partnerNetworkID = partnerNetwork.partnerNetworkID;
        settlementTransaction.partnerNetworkName = partnerNetwork.partnerNetworkName;
    }


    const vatAmount = settlementTransaction.settlementAmount - (settlementTransaction.settlementAmount / ((settlementTransaction.vatPercent / 100) + 1));

    settlementTransaction.vatAmount = vatAmount;

    voucher.settlementList.settlementTransactions.push(settlementTransaction);

    if (isRedeemed) {
        voucher.isRedeemed = isRedeemed;
    }

    voucher.voucherValue.fixedAmount === updatedVoucherValue.fixedAmount;
    voucher.voucherValue.redemptionsLeft === updatedVoucherValue.redemptionsLeft;

    const id = voucher._id;
    const key = voucher.partitionKey;
    delete voucher._id;
    delete voucher.partitionKey;

    const allReq = [];
    allReq.push(settlementTransaction);
    allReq.push(collection.updateOne({
        _id: id,
        docType: 'vouchers',
        partitionKey: key
    }, {
        $set: Object.assign(
            {}, voucher,
            {
                updatedDate: new Date()
            }
        )
    }));
    return Promise.all(allReq);
};

exports.buildRedemptionRecord = (voucher, requestBody, settlementTransaction) => {

    const redemption = Object.assign(
        {},
        sampleRedemption,
        {
            docType: 'redemption',
            createdDate: new Date(),
            updatedDate: new Date()
        }
    );

    const collectorMerchant = [{
        merchantID: settlementTransaction.merchantID,
        merchantName: settlementTransaction.merchantName
    }];


    const voucherValue = {
        valueType: voucher.voucherValue.valueType,
        spend: voucher.voucherValue.spend,
        redemptionsTotal: voucher.voucherValue.redemptionsTotal,
        redemptionsLeft: voucher.voucherValue.redemptionsLeft,
        fixedAmount: voucher.voucherValue.fixedAmount,
        currency: requestBody.currency,
        ratioPercent: voucher.voucherValue.ratioPercent
    };
    const redeemedValue = {
        valueType: voucher.voucherValue.valueType,
        redemptionsUsed: requestBody.redemptionsCount || 1,
        redeemedAmount: Number(requestBody.fixedAmount) || 0,
        currency: requestBody.currency
    };

    redemption._id = uuid.v4();
    redemption.docType = 'redemption';
    redemption.partitionKey = redemption._id;
    redemption.redemptionDate = new Date();
    redemption.redemptionStatus = 'successfull';
    redemption.voucherID = voucher._id;
    redemption.isRedeemed = voucher.isRedeemed;
    redemption.redemptionCounter = voucher.redemptionCounter;
    redemption.issuer = voucher.issuer;
    redemption.productID = voucher.productID;
    redemption.orderID = voucher.orderID;
    redemption.orderDate = voucher.orderDate;
    redemption.salesPrice = voucher.salesPrice;
    redemption.vatPercent = voucher.vatPercent;
    redemption.vatAmount = voucher.vatAmount;
    redemption.currency = voucher.currency;
    redemption.settlementTransactionID = settlementTransaction.settlementTransactionID;
    redemption.collectorMerchant = collectorMerchant;
    redemption.collectorBusinessUnit = voucher.collectorLimitationsBusinessUnits;
    //redemption.collectorPointOfService = voucher.collectorLimitationsPointOfService;
    redemption.posProduct = voucher.posProductLimitations;
    redemption.voucherValue = voucherValue;
    redemption.redeemedValue = redeemedValue;
    redemption.redemptionCode = requestBody.redemptionCode;
    redemption.salesPersonCode = requestBody.salesPersonCode;
    redemption.campaignCode = voucher.campaignCode;
    redemption.productName = voucher.voucherTitle;
    redemption.voucherSequenceNumber = voucher.voucherSequenceNumber;
    if (voucher.collectorPointOfService)
        redemption.collectorPointOfService = voucher.collectorPointOfService;
    redemption.voucherCreatedDate = new Date();
    return redemption;
};