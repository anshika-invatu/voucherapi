'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = (context, req) => {
    let voucherCollection, isError = false;
    return utils
        .validateUUIDField(context, req.query.partnerNetworkID, 'The partnerNetworkID field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            return collection.findOne({
                partitionKey: req.query.partnerNetworkID,
                linkedID: req.params.linkedID,
                docType: 'voucherLink'
            });
        })
        .then(voucherLink => {
            if (voucherLink) {
                const passToken = voucherLink.passToken.toLowerCase();
                return voucherCollection.findOne({
                    _id: voucherLink.voucherID,
                    partitionKey: passToken,
                    passToken: passToken,
                    docType: 'vouchers'
                });
               
            } else {
                isError = true;
                return utils.setContextResError(
                    context,
                    new errors.VoucherLinkNotFoundError(
                        'The voucherLink partnerNetworkID specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .then(voucher =>{
            if (voucher) {
                context.res = {
                    body: voucher
                };
            } else if (!isError) {
                utils.setContextResError(
                    context,
                    new errors.VoucherNotFoundError(
                        'The voucher id specified in the URL doesn\'t exist.',
                        404
                    )
                );
            }
        })
        .catch(error => utils.handleError(context, error));
};
