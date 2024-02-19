'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = (context, req) => {
    let passTokenHashed = '';
    return utils
        .validateUUIDField(context, req.params.id, 'The pass id specified in the URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Passes'))
        .then(collection => collection.findOne(
            {
                _id: req.params.id,
                docType: 'passes',
                partitionKey: req.params.id//bac-178 related to partitionKey
            }
        ))
        .then(pass => {
            if (pass) {
                passTokenHashed = utils.hashToken(pass.passToken);
                return getMongodbCollection('Vouchers');
            } else {
                context.res = {
                    body: []
                };
            }
        })
        .then(collection => {
            if (collection) {
                return collection.find({
                    passToken: passTokenHashed,
                    docType: 'vouchers',
                    partitionKey: passTokenHashed
                })
                    .toArray();
            } else {
                return Promise.resolve();
            }
        })
        .then(vouchers => {
            if (vouchers) {
                context.res = {
                    body: vouchers
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
