'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = async (context, req) => {
    try {
        const collection = await getMongodbCollection('Vouchers');

        const balanceAccounts = await collection.find({
            fromBalanceAccountID: req.params.fromBalanceAccountID,
            toBalanceAccountID: req.params.toBalanceAccountID,
            docType: 'balanceAccountTransactions'
        }).toArray();
        let deletedCount = 0;
        context.log(balanceAccounts.length);
        if (balanceAccounts && Array.isArray(balanceAccounts)) {
            await balanceAccounts.forEach(async element => {
                await collection.deleteOne({
                    _id: element._id,
                    partitionKey: element._id,
                    docType: 'balanceAccountTransactions'
                });
                deletedCount ++;
            });
        }
        context.res = {
            body: {
                code: 200,
                deletedCount: deletedCount,
                description: 'Successfully deleted the balanceAccount of specified details'
            }
        };
    } catch (error) {
        context.log(error);
        utils.handleError(context, error);
    }
};
