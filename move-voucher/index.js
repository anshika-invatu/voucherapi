'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');
const uuid = require('uuid');

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
    let fromPass;
    let toPass;
    let passesCollection;
    let vouchersCollection;
    var isError = false;
    var oldVoucher;
    return utils.validateUUIDField(context, req.body.fromPassID, 'The fromWalletID specified in the body does not match the UUID v4 format.')
        .then(() => utils.validateUUIDField(context, req.body.toPassID, 'The toPassID specified in the body does not match the UUID v4 format.'))
        .then(() => utils.validateUUIDField(context, req.body.voucherID, 'The voucherID specified in the body does not match the UUID v4 format.'))
        .then(() => getMongodbCollection('Passes'))
        .then(collection => {
            passesCollection = collection;
            return collection.findOne({
                _id: req.body.fromPassID,
                docType: 'passes',
                partitionKey: req.body.fromPassID
            });
        })
        .then(result => { // Get the pass from which voucher needs to be moved
            if (result) {
                fromPass = result;
                return passesCollection.findOne({
                    _id: req.body.toPassID,
                    docType: 'passes',
                    partitionKey: req.body.toPassID
                });
            } else {
                isError = true;
                utils.setContextResError(
                    context,
                    new errors.PassNotFoundError(
                        'The fromPassID specified in the body doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .then(result => { // Get the pass to which voucher needs to be moved
            if (!isError) {
                if (result) {
                    toPass = result;
                    return getMongodbCollection('Vouchers');
                } else {
                    isError = true;
                    utils.setContextResError(
                        context,
                        new errors.PassNotFoundError(
                            'The toPassID specified in the body doesn\'t exist.',
                            404
                        )
                    );
                }
            }
        })
        .then(result => {
            if (!isError && result) {
                vouchersCollection = result;
                return result.findOne({
                    _id: req.body.voucherID,
                    docType: 'vouchers'
                });
            }
        })
        .then(result => { // Get Voucher
            if (!isError) {
                if (result) {
                    oldVoucher = result;
                    if (result.passToken === utils.hashToken(fromPass.passToken)) { // Validate whether voucher linked to sender pass
                        const voucher = Object.assign(
                            {},
                            result,
                            {
                                _id: uuid.v4(),
                                passToken: utils.hashToken(toPass.passToken),
                                partitionKey: utils.hashToken(toPass.passToken),
                                updatedDate: new Date()
                            }
                        );
                        return vouchersCollection.insertOne(voucher);
                    } else {
                        isError = true;
                        utils.setContextResError(
                            context,
                            new errors.FieldValidationError(
                                'The voucher id specified in the body is not linked to sender pass.',
                                400
                            )
                        );
                    }
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
        .then(result => {
            if (result) {
                return vouchersCollection.deleteOne({ _id: oldVoucher._id, docType: 'vouchers', partitionKey: oldVoucher.passToken });
            }
        })
        .then(result => {
            if (!isError && result) {
                if (result && result.deletedCount === 1) {
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Voucher moved successfully.'
                        }
                    };
                }
            }
        })
        .catch(error => utils.handleError(context, error));

};
