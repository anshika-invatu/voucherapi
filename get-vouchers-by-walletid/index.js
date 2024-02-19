'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');

module.exports = (context, req) => {
    let passTokenHashed = '';
    let passesArr = [];
    return utils
        .validateUUIDField(context, req.params.id, 'The wallet id specified in the URL does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Passes'))
        .then(collection => collection.find(
            {
                walletID: req.params.id,
                docType: 'passes'
            }
        ).toArray())
        .then(passes => {
            if (Array.isArray(passes) && passes.length > 0) {
                passesArr = passes;
                return getMongodbCollection('Vouchers');
            } else {
                context.res = {
                    body: []
                };
            }
        })
        .then(collection => {
            var orQuery = [];
            passesArr.forEach(element => {
                passTokenHashed = utils.hashToken(element.passToken);
                orQuery.push({ passToken: passTokenHashed });
            });
            if (collection) {
                return collection.find({
                    $or: orQuery,
                    docType: 'vouchers',
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
