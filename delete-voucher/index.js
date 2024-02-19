'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');

module.exports = async (context, req) => {


    let collections, voucher;
    return utils
        .validateUUIDField(context, req.params.id)
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            collections = collection;
            console.log('colections',collections);
            return collection.findOne({
                _id: req.params.id,
                docType: 'vouchers'
            });
        })
        .then(result => {
            //if (result || result.passToken) {
            if (result) {
                voucher = result;
                return collections.deleteOne({
                    _id: req.params.id,
                    docType: 'vouchers',
                    partitionKey: req.params.id,//result.passToken//bac-178 related to partitionKey
                });
            }
        })
        .then(result => {
            console.log('deleted voucher ',result);
            if (result && result.deletedCount === 1) {
                context.res = {
                    body: {
                        description: 'Successfully deleted the specified voucher'
                    }
                };
                voucher.event = 'deleted';
                try { //voucher send with event(bac-151)
                    utils.sendMessageToAzureBus(process.env.AZURE_BUS_TOPIC_VOUCHER_UPDATES, voucher);
                } catch (err) {
                    console.log(err);
                }
            } else {
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
