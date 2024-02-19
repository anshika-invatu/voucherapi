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
                'You\'ve requested to create a new voucher but the request body seems to be empty. Kindly pass the voucher to be created using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }

    return utils.validateUUIDField(context, `${req.body._id}`, 'The _id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const voucher = Object.assign(
                {},
                utils.formatDateFields(req.body),
                {
                    passToken: req.body.passToken.toLowerCase(),
                    partitionKey: req.body.passToken.toLowerCase(), //bac-178 related to partitionKey
                    docType: 'vouchers',
                    event: 'created',
                    createdDate: new Date(),
                    updatedDate: new Date()
                }
            );
            return collection.insertOne(voucher);
        })
        .then(response => {
            const voucher = response.ops[0];
            context.res = {
                body: voucher
            };
            try { //voucher send with event(bac-151)
                utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, voucher);
            } catch (err) {
                console.log(err);
            }
        })
        .catch(error => utils.handleError(context, error));
};
