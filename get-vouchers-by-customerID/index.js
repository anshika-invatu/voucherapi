'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const moment = require('moment');


module.exports = async (context, req) => {
    try {
        await utils.validateUUIDField(context, req.params.id, 'The customerID specified in the request does not match the UUID v4 format.');
        const collection = await getMongodbCollection('Vouchers');
        const query = {
            docType: 'vouchers',
            customerID: req.params.id
        };
        if (req.query.fromDate && req.query.toDate()) {
            query.createdDate = {
                $gte: moment(req.query.fromDate).startOf('day')
                    .toDate(),
                $lte: new Date(req.query.toDate)
            };
        }
        const orders = await collection.find(query)
            .sort({ createdDate: 1 })
            .toArray();

        context.res = {
            body: orders
        };
    } catch (error) {
        utils.handleError(context, error);
    }
};
