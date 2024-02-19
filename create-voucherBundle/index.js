'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to create a new voucherBundle but the request body seems to be empty. Kindly pass the voucherBundle to be created using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }

    return utils.validateUUIDField(context, `${req.body._id}`, 'The _id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const voucherBundle = Object.assign(
                {},
                utils.formatDateFields(req.body),
                {
                    partitionKey: req.body.partitionKey.toLowerCase(),
                    docType: 'voucherBundle',
                    createdDate: new Date(),
                    updatedDate: new Date()
                }
            );
            return collection.insertOne(voucherBundle);
        })
        .then(response => {
            const voucherBundle = response.ops[0];
            context.res = {
                body: voucherBundle
            };
        })
        .catch(error => utils.handleError(context, error));
};
