'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = (context, req) => {
    let deletedCount;
    let voucherCollection;
    return getMongodbCollection('Vouchers')
        .then(collection => {
            voucherCollection = collection;
            return collection.deleteMany({
                voucherID: req.params.id,
                partitionKey: req.params.id,
                docType: 'voucherLog'
            });
        })
        .then(result => {
            if (result) {
                deletedCount = result.deletedCount;
            }
            return utils.deleteBlob(req.params.id);
        })
        .then(result => {
            console.log(result);
            return voucherCollection.find({ docType: 'redemption', voucherID: req.params.id }).toArray();
        })
        .then(results => {
            if (results && Array.isArray(results)) {
                const allRedemptionRequest = [];
                results.forEach(element => {
                    allRedemptionRequest.push(voucherCollection.deleteOne({ docType: 'redemption', _id: element._id, partitionKey: element._id }));
                });
                return Promise.all(allRedemptionRequest);
            }
        })
        .then(result => {
            if (result && Array.isArray(result)) {
                result.forEach(element => {
                    console.log(element.deletedCount);
                });
            }
            context.res = {
                body: deletedCount
            };
        })
        .catch(error => utils.handleError(context, error));
};
