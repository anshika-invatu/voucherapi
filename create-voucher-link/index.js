'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');
const uuid = require('uuid');

//Please refer bac-427 for this endpoint related details

module.exports = async (context, req) => {
    if (!req.body) {
        return utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to create a new voucher-link but the request body seems to be empty. Kindly pass the voucher-link to be created using request body in application/json format',
                400
            )
        );
    }

    try {
        await utils.validateUUIDField(context, `${req.body.partnerNetworkID}`, 'The partnerNetworkID field specified in the request body does not match the UUID v4 format.');
        
        const collection = await getMongodbCollection('Vouchers');

        const voucher = await collection.findOne({
            _id: req.body.voucherID,
            partitionKey: req.body.passToken,
            passToken: req.body.passToken,
            docType: 'vouchers'
        });

        let externalID = req.body.externalID.trim();
        externalID = utils.hashToken(externalID).toLowerCase();

        const oldVoucherLink =  await collection.findOne({
            partitionKey: req.body.partnerNetworkID,
            linkedID: externalID
        });

        if (oldVoucherLink) {
            return utils.setContextResError(
                context,
                new errors.DuplicateVoucherLinkError(
                    'VoucherLink is already exist with this linkedID for this partner network.',
                    409
                )
            );
        }

        const voucherLinkDoc = {};
        voucherLinkDoc._id = uuid.v4();
        voucherLinkDoc.docType = 'voucherLink';
        voucherLinkDoc.partitionKey = req.body.partnerNetworkID;
        voucherLinkDoc.partnerNetworkID = req.body.partnerNetworkID;
        voucherLinkDoc.voucherLinkType = req.body.voucherLinkType;
        voucherLinkDoc.linkedID = externalID;
        voucherLinkDoc.linkedIDName = req.body.linkedIDName;
        voucherLinkDoc.voucherID = req.body.voucherID;
        voucherLinkDoc.voucherToken = req.body.voucherToken;
        voucherLinkDoc.passToken = req.body.passToken;
        voucherLinkDoc.createdDate = new Date();
        voucherLinkDoc.updatedDate = new Date();
        let validTime;
        const currentDate = new Date();
        if (voucher && voucher.validPeriod && voucher.validPeriod.validToDate) {
            validTime = (new Date(voucher.validPeriod.validToDate) - currentDate) / 1000; //get time in sec
        } else {
            validTime = 60 * 60 * 24 * 30 * 12 * 2; //2 year.
        }
        voucherLinkDoc._ts = currentDate;
        voucherLinkDoc.ttl = validTime;
        const response = await collection.insertOne(voucherLinkDoc);
        const voucherLink = response.ops[0];
        context.res = {
            body: voucherLink
        };
    } catch (err) {
        context.log(err);
        utils.handleError(context, err);
    }
};
