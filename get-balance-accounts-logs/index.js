'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const moment = require('moment');


module.exports = (context, req) => {
    return utils
        .validateUUIDField(context, req.params.balanceAccountID, 'The balanceAccountID field specified in the request does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            const query = {
                $or: [ { fromBalanceAccountID: req.params.balanceAccountID }, { toBalanceAccountID: req.params.balanceAccountID } ],
                docType: 'balanceAccountTransactions',
            };
            if (req.query.fromDate && req.query.toDate) {
                const fromDate = new Date(req.query.fromDate);
                const toDate = moment(req.query.toDate, 'YYYY-MM-DD').add(23, 'hours')
                    .add(59, 'minutes')
                    .add(59, 'seconds')
                    .toDate();

                query.createdDate = {
                    $gte: fromDate,
                    $lt: toDate
                };
                return collection.find(query).sort({ 'createdDate': -1 })
                    .toArray();
            } else {
                return collection.find(query).sort({ 'createdDate': -1 })
                    .limit(50)
                    .toArray();
            }
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
