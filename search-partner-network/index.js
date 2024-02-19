'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');

//Please refer the bac-346 for further details

module.exports = async (context, req) => {
    try {
        const collection = await getMongodbCollection('Vouchers');
        var query = [];
        if (req.query.partnerNetworkID) {
            query.push({ _id: { '$regex': new RegExp('.*' + req.query.partnerNetworkID + '.*', 'i') }});
        }
        if (req.query.partnerNetworkName) {
            query.push({ partnerNetworkName: { '$regex': new RegExp('.*' + req.query.partnerNetworkName + '.*', 'i') }});
        }
        if (req.query.merchantID) {
            query.push({ ownerMerchantID: { '$regex': new RegExp('.*' + req.query.merchantID + '.*', 'i') }});
        }
        const partnerNetworks = await collection.find({
            $and: query,
            docType: 'partnerNetworks'
        })
            .project({
                partnerNetworkName: 1,
                partnerNetworkDescription: 1
            })
            .limit(200)
            .toArray();
       
        if (partnerNetworks && Array.isArray(partnerNetworks) && partnerNetworks.length > 0) {
            context.res = {
                body: partnerNetworks
            };
        } else {
            utils.setContextResError(
                context,
                new errors.PartnerNetworkNotFoundError(
                    'The partnerNetwork of specified details in the URL doesn\'t exist.',
                    404
                )
            );
        }
        return Promise.resolve();
    } catch (error) {
        utils.handleError(context, error);
    }
};
