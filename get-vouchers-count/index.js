'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = async (context) => {
    try {
        const collection = await getMongodbCollection('Vouchers');
        const result = await collection.aggregate([
            { $match: { docType: 'vouchers' }},
            { $group: { _id: null, n: { $sum: 1 }}}
        ]).toArray();
        if (result && result.length) {
            context.res = {
                body: result[0].n
            };
        }
    } catch (error) {
        utils.handleError(context, error);
    }
};
