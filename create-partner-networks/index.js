'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const Promise = require('bluebird');
const errors = require('../errors');
const uuid = require('uuid');

//Please refer the bac-346, 368 for further details

module.exports = (context, req) => {
    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to create a new partnerNetwork the request body seems to be empty. Kindly pass the partnerNetwork to be created using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    let partnerNetwork, voucherCollection;
    return utils.validateUUIDField(context, `${req.body._id}`, 'The _id field specified in the request body does not match the UUID v4 format.')
        .then(() => getMongodbCollection('Vouchers'))
        .then(collection => {
            voucherCollection = collection;
            const partnerNetwork = Object.assign(
                {},
                utils.formatDateFields(req.body),
                {
                    partitionKey: req.body._id,
                    docType: 'partnerNetworks',
                    createdDate: new Date(),
                    updatedDate: new Date()
                }
            );
            return voucherCollection.insertOne(partnerNetwork);
        })
        .then(response => {
            if (response) {
                partnerNetwork = response.ops[0];
                return voucherCollection.findOne({
                    partitionKey: req.body.ownerMerchantID,
                    merchantID: req.body.ownerMerchantID,
                    docType: 'merchantPartnerNetworks'
                });
            }
        })
        .then(merchantPartnerNetworksDoc =>{
            if (merchantPartnerNetworksDoc) {
                return voucherCollection.updateOne({
                    partitionKey: req.body.ownerMerchantID,
                    merchantID: req.body.ownerMerchantID,
                    docType: 'merchantPartnerNetworks'
                },
                {
                    $push: { partnerNetworkMemberships: {
                        partnerNetworkID: req.body._id,
                        partnerNetworkName: req.body.partnerNetworkName,
                        roles: 'admin'
                    }}
                });
            } else if (partnerNetwork) {
                const merchantPartnerNetworks = {};
                merchantPartnerNetworks._id = uuid.v4();
                merchantPartnerNetworks.docType = 'merchantPartnerNetworks';
                merchantPartnerNetworks.partitionKey = req.body.ownerMerchantID;
                merchantPartnerNetworks.merchantID = req.body.ownerMerchantID;
                merchantPartnerNetworks.merchantName = req.body.ownerMerchantName;
                merchantPartnerNetworks.partnerNetworkMemberships = new Array({
                    partnerNetworkID: req.body._id,
                    partnerNetworkName: req.body.partnerNetworkName,
                    roles: 'admin'
                });
                return voucherCollection.insertOne(merchantPartnerNetworks);
            }
        })
        .then(result => {
            if (result && partnerNetwork) {
                context.res = {
                    body: partnerNetwork
                };
            }
        })
        .catch(error => utils.handleError(context, error));
};
