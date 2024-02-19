'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

module.exports = async (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to update a voucher but the request body seems to be empty. Kindly specify the voucher properties to be updated using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    try {
        await utils.validateUUIDField(context, req.params.voucherID);
        const collection = await getMongodbCollection('Vouchers');
        const voucher = await collection.findOne({
            _id: req.params.voucherID,
            docType: 'vouchers'
        });
        if (!voucher) {
            utils.setContextResError(
                context,
                new errors.VoucherNotFoundError(
                    'The voucher id specified in the URL doesn\'t exist.',
                    404
                )
            );
            return Promise.resolve();
        }
        let isVoucherAbleToUpdate = false;
        if (voucher && voucher.issuer && voucher.issuer.merchantID === req.params.id)
            isVoucherAbleToUpdate = true;
        if (!isVoucherAbleToUpdate) {
            utils.setContextResError(
                context,
                new errors.UserNotAuthenticatedError(
                    'MerchantID not linked to user',
                    401
                )
            );
            return Promise.resolve();
        }
        let result;
        if (voucher && voucher.passToken) {
            const query = {};
            query._id = req.params.voucherID;
            query.docType = 'vouchers';
            query.partitionKey = voucher.passToken;
            result = await collection.updateOne(query, {
                $set: Object.assign(
                    {},
                    utils.formatDateFields(req.body),
                    {
                        updatedDate: new Date()
                    }
                )
            });
        }
        if (result.matchedCount) {
            context.res = {
                body: {
                    description: 'Successfully updated the document'
                }
            };
        } else {
            utils.setContextResError(
                context,
                new errors.VoucherNotFoundError(
                    'The voucher id specified in the URL doesn\'t exist.',
                    404
                )
            );
        }
    } catch (error) {
        utils.handleError(context, error);
    }
};
