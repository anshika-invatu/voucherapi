'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const moment = require('moment');

//Please refer bac-201,207 for this endpoint related details

module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.id, 'The merchantID field specified in the request URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const fromDate = new Date(req.params.fromDate);
            let toDate = new Date(req.params.toDate);

            toDate = moment(req.params.toDate, 'YYYY-MM-DD').add(23, 'hours')
                .add(59, 'minutes')
                .add(59, 'seconds')
                .toDate();
            const query = {
                'collectorMerchant.merchantID': req.params.id,
                docType: 'redemption',
                redemptionDate: {
                    $gte: fromDate,
                    $lt: toDate
                }
            };
            if (req.query && req.query.orderID) {
                query.orderID = req.query.orderID;
            }
            if (req.query && req.query.voucherID) {
                query.voucherID = req.query.voucherID;
            }
            return collection.find(query).limit(100)
                .toArray();
        })
        .then(result => {
            if (result) {
                context.res = {
                    body: result
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
