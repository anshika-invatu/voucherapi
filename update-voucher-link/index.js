'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer bac-427 for this endpoint related details

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to update a voucher-link but the request body seems to be empty. Kindly specify the voucher-link properties to be updated using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    if (!req.body.externalID) {
        utils.setContextResError(
            context,
            new errors.FieldValidationError(
                'externalID is not present in req body.',
                409
            )
        );
        return Promise.resolve();
    }

    return utils
        .validateUUIDField(context, req.params.partnerNetworkID, 'The partnerNetworkID field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            let externalID = req.body.externalID.trim();
            externalID = utils.hashToken(externalID).toLowerCase();
            const query = {
                partitionKey: req.params.partnerNetworkID,
                docType: 'voucherLink',
                linkedID: externalID
            };
            const reqBody = {};
            let updatedExternalID;
            if (req.body.updatedExternalID) {
                updatedExternalID = req.body.updatedExternalID.trim();
                updatedExternalID = utils.hashToken(updatedExternalID).toLowerCase();
                reqBody.linkedID = updatedExternalID;
            }
            if (req.body.linkedIDName) {
                reqBody.linkedIDName = req.body.linkedIDName;
            }
            reqBody.updatedDate = new Date();
            
            return collection.updateOne(query, {
                $set: reqBody
            });
        })
        .then(result => {
            if (result) {
                if (result.matchedCount) {
                    context.res = {
                        body: {
                            code: 200,
                            description: 'Successfully updated the document.'
                        }
                    };
                } else {
                    utils.setContextResError(
                        context,
                        new errors.VoucherLinkNotFoundError(
                            'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                            404
                        )
                    );
                }
            } else {
                utils.setContextResError(
                    context,
                    new errors.VoucherLinkNotFoundError(
                        'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
