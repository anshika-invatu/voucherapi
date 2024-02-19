'use strict';

const utils = require('../utils');
const Promise = require('bluebird');
const { getMongodbCollection } = require('../db/mongodb');
const { CustomLogs } = utils;

module.exports = async (context, mySbMsg) => {
    CustomLogs(mySbMsg,context);
    if (!mySbMsg && !mySbMsg.event || mySbMsg.event !== 'nameUpdated') {
        return Promise.resolve();
    }
    try {
        const voucherCollection = await getMongodbCollection('Vouchers');
        const bulk =  await voucherCollection.initializeOrderedBulkOp();
        const merchantsIds = [];
        if (mySbMsg.partnerNetworkMembers && Array.isArray(mySbMsg.partnerNetworkMembers)) {
            mySbMsg.partnerNetworkMembers.forEach(element => {
                merchantsIds.push(element.merchantID);
            });
        }
        if (mySbMsg.partnerNetworkInvites && Array.isArray(mySbMsg.partnerNetworkInvites)) {
            mySbMsg.partnerNetworkInvites.forEach(element => {
                merchantsIds.push(element.merchantID);
            });
        }
        if (!merchantsIds.length) {
            return Promise.resolve();
        }
        CustomLogs(`merchantID's to be processed is = ${JSON.stringify(merchantsIds)}`,context);
        const merchantPartnerNetworks = await voucherCollection.find(
            {
                merchantID: { $in: merchantsIds },
                partitionKey: { $in: merchantsIds },
                docType: 'merchantPartnerNetworks',
            }).toArray();

        const reqPartnerNetwork = {};
        reqPartnerNetwork.partnerNetworkID = mySbMsg._id;
        reqPartnerNetwork.merchantIDs = merchantsIds;
        utils.logInfo(reqPartnerNetwork);
        if (merchantPartnerNetworks && Array.isArray(merchantPartnerNetworks)) {
            CustomLogs(`No of merchantPartnerNetwork docs = ${merchantPartnerNetworks.length}`,context);
            await merchantPartnerNetworks.map(async merchantPartnerNetwork => {
                CustomLogs(`merchantPartnerNetwork _id = ${merchantPartnerNetwork._id}`,context);
                if (merchantPartnerNetwork && merchantPartnerNetwork.partnerNetworkMemberships && Array.isArray(merchantPartnerNetwork.partnerNetworkMemberships)) {
                    await merchantPartnerNetwork.partnerNetworkMemberships.map(async partnerNetworkMember => {
                        if (partnerNetworkMember.partnerNetworkID === mySbMsg._id) {
                            const role = partnerNetworkMember.roles;
                            bulk.find({ partitionKey: merchantPartnerNetwork.merchantID, docType: 'merchantPartnerNetworks' }).update({ $pull: { partnerNetworkMemberships: { partnerNetworkID: mySbMsg._id }}});
                            bulk.find({ partitionKey: merchantPartnerNetwork.merchantID, docType: 'merchantPartnerNetworks' }).update({ $push: { partnerNetworkMemberships: { partnerNetworkID: mySbMsg._id, partnerNetworkName: mySbMsg.partnerNetworkName, roles: role }}});
                        }
                    });
                }
                if (merchantPartnerNetwork && merchantPartnerNetwork.partnerNetworkInvites && Array.isArray(merchantPartnerNetwork.partnerNetworkInvites)) {
                    await merchantPartnerNetwork.partnerNetworkInvites.map(async partnerNetworkInvite => {
                        if (partnerNetworkInvite.partnerNetworkID === mySbMsg._id) {
                            const role = partnerNetworkInvite.roles;
                            const inviteExpiryDate = partnerNetworkInvite.inviteExpiryDate;
                            bulk.find({ partitionKey: merchantPartnerNetwork.merchantID, docType: 'merchantPartnerNetworks' }).update({ $pull: { partnerNetworkInvites: { partnerNetworkID: mySbMsg._id }}});
                            bulk.find({ partitionKey: merchantPartnerNetwork.merchantID, docType: 'merchantPartnerNetworks' }).update({ $push: { partnerNetworkInvites: { partnerNetworkID: mySbMsg._id, partnerNetworkName: mySbMsg.partnerNetworkName, roles: role, inviteExpiryDate: inviteExpiryDate }}});
                        }
                    });
                }
            });
            await bulk.execute();
        }
    } catch (error) {
        context.log.error(error);
        //utils.handleError(context, error);
        utils.logEvents(error.message);
    }
    return Promise.resolve();
};