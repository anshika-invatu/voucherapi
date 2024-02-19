'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const request = require('request-promise');
const errors = require('../errors');

module.exports = (context, req) => {

    let isReqBodyHaveAnyField = false;
    let voucherCollection;

    if (!req.body) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to get vouchers but the request body seems to be empty. Kindly pass the atleast one parameter using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    for (var prop in req.body) {
        if (req.body.hasOwnProperty(prop)) {
            isReqBodyHaveAnyField = true;
        }
    }
    if (!isReqBodyHaveAnyField) {
        utils.setContextResError(
            context,
            new errors.EmptyRequestBodyError(
                'You\'ve requested to get vouchers but the request body seems to be empty. Kindly pass the atleast one parameter using request body in application/json format',
                400
            )
        );
        return Promise.resolve();
    }
    return getMongodbCollection('Vouchers')
        .then(collection => {
            voucherCollection = collection;
            if (req.body.email) {
                return request.get(`${process.env.WALLET_API_URL}/api/${process.env.WALLET_API_VERSION}/users/${req.body.email}/wallet`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.WALLET_API_KEY
                    }
                });
            } else if (req.body.mobilephone) {
                return request.get(`${process.env.WALLET_API_URL}/api/${process.env.WALLET_API_VERSION}/users/${req.body.mobilephone}/wallet`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.WALLET_API_KEY
                    }
                });
            }
        })
        .then(wallet => {
            if (wallet && wallet._id) {
                const url = `${process.env.PASSES_API_URL}/api/${process.env.PASSES_API_VERSION}/wallets/${wallet._id}/passes`;
                return request.get(url, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.PASSES_API_KEY
                    }
                });
            }
        })
        .then(passes => {
            const query = {
                'issuer.merchantID': { $in: req.body.merchantIDs }
            };
            const passTokens = [];
            const hashedPassToken = [];
            if (passes && Array.isArray(passes)) {
                passes.forEach(pass => {
                    passTokens.push(pass.passToken);
                });
            }
            let isMatched = false;
            if (passTokens.length) {
                passTokens.forEach(element => {
                    const passToken = utils.hashToken(element);
                    hashedPassToken.push(passToken.toLowerCase());
                    if (req.body.passToken) {
                        const passTokenFromReq = utils.hashToken(req.body.passToken);
                        if (passToken.toLowerCase() === passTokenFromReq.toLowerCase()) {
                            isMatched = true;
                        }
                    }
                });
                if (isMatched || !req.body.passToken) {
                    query.passToken = { $in: hashedPassToken };
                    query.partitionKey = { $in: hashedPassToken };
                } else if (req.body.passToken) {
                    const passToken = utils.hashToken(req.body.passToken);
                    query.passToken = passToken.toLowerCase();
                }

            } else if (req.body.passToken) {
                const passToken = utils.hashToken(req.body.passToken);
                query.passToken = passToken.toLowerCase();
            }
            if (req.body.voucherToken) {
                query.voucherToken = req.body.voucherToken;
            }
            if (req.body.orderID) {
                query.orderID = req.body.orderID;
            }
            if (req.body.productID) {
                query.productID = req.body.productID;
            }
            if (req.body.fromOrderDate && req.body.toOrderDate) {
                let fromOrderDate = new Date(req.body.fromOrderDate);
                fromOrderDate = fromOrderDate.setHours(0, 0, 1);
                let toOrderDate = new Date(req.body.toOrderDate);
                toOrderDate = toOrderDate.setHours(23, 59, 59);
                query.orderDate = {
                    $gte: fromOrderDate,
                    $lt: toOrderDate
                };
            }
            if (req.body.isRedeemed !== undefined) {
                query.isRedeemed = req.body.isRedeemed;
            }
            return voucherCollection.find(query).toArray();
        })
        .then(vouchers => {
            context.res = {
                body: vouchers
            };
        })
        .catch(error => utils.handleError(context, error));
};
