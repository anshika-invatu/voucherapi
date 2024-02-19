'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

module.exports = (context, req) => {
    let collections;
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

    if (req.body && (!req.body.event || (req.body.event !== 'locked' && req.body.event !== 'unlocked' && req.body.event !== 'expired' && req.body.event !== 'bundleFirstRedemption'))) {
        req.body.event = 'updated';
    }

    return utils
        .validateUUIDField(context, req.params.id)
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            collections = collection;
            return collection.findOne({
                _id: req.params.id,
                docType: 'vouchers'
            });
        })
        .then(result => {
            if (result && result.passToken) {
                if (Object.keys(req.body).length) {
                    const query = {};
                    query._id = req.params.id;
                    query.docType = 'vouchers';
                    query.partitionKey = result.passToken;//bac-178 related to partitionKey
                    return collections.updateOne(query, {
                        $set: Object.assign(
                            {},
                            utils.formatDateFields(req.body),
                            {
                                updatedDate: new Date()
                            }
                        )
                    });
                } else {
                    return Promise.resolve();
                }
            }
        })
        .then(result => {
            if (result) {
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
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherNotFoundError(
                        'The voucher id specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .then(() => {
            return collections.findOne({
                _id: req.params.id,
                docType: 'vouchers'
            });
        })
        .then(result => {
            if (result) {
                if (result.event === 'updated' || result.event === 'locked' || result.event === 'unlocked' || result.event === 'expired') {
                    try { //voucher send with event(bac-151)
                        utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, result);
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        })
        .catch(error => utils.handleError(context, error));
};
