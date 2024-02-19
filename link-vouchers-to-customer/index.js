'use strict';

const utils = require('../utils');
const uuid = require('uuid');
const request = require('request-promise');
const moment = require('moment');
const { getMongodbCollection } = require('../db/mongodb');
const { CustomLogs } = utils;
const { customAlphabet } = require('nanoid');

//Please refer the BASE-117 for further details

module.exports = async (context, mySbMsg) => {
    try {
        await CustomLogs(`voucher _id = ${mySbMsg._id} having event = ${mySbMsg.event}`, context);
        if (mySbMsg.event !== 'created')
            return Promise.resolve();
        if (mySbMsg.customerID)
            return Promise.resolve();
        const order = await request.get(`${process.env.ORDER_API_URL}/api/${process.env.ORDER_API_VERSION}/orders/${mySbMsg.orderID}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.ORDER_API_KEY
            }
        });
        let customerID;
        if (order.customerID)
            customerID = order.customerID;
        if (!customerID) {
            let email, mobilePhone, customer;
            if (order.customerEmail)
                email = order.customerEmail;
            if (!email)
                email = order.receiverEmail;
            if (email)
                customer = await request.get(`${process.env.CUSTOMER_API_URL}/api/${process.env.CUSTOMER_API_VERSION}/customer/${email}?merchantID=${mySbMsg.issuer.merchantID}`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.CUSTOMER_API_KEY
                    }
                });
            else if (order.receiverMobilePhone) {
                mobilePhone = order.receiverMobilePhone;
                customer = await request.get(`${process.env.CUSTOMER_API_URL}/api/${process.env.CUSTOMER_API_VERSION}/customer/${order.receiverMobilePhone}?merchantID=${mySbMsg.issuer.merchantID}`, {
                    json: true,
                    headers: {
                        'x-functions-key': process.env.CUSTOMER_API_KEY
                    }
                });
            }
            const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);
            const customerName = nanoid();
            if (!customer) {
                customer = {};
                customer._id = uuid.v4();
                customer.docType = 'customers';
                customer.partitionKey = customer._id;
                customer.merchantID = order.sellerMerchantID;
                customer.merchantName = order.sellerMerchantName;
                customer.customerType = 'person';
                customer.customerName = customerName;
                customer.customerDescription = 'From order';
                customer.currency = order.currency;
                customer.isEnabled = true;
                customer.validFromDate = new Date();
                customer.validToDate = moment().add(5, 'Y')
                    .toDate();
                customer.email = email;
                customer.mobilePhone = mobilePhone;
                customer.person = {
                    walletID: order.walletID
                };
                customer.createdDate = new Date();
                customer.updatedDate = new Date();
                customer = await request.post(`${process.env.CUSTOMER_API_URL}/api/${process.env.CUSTOMER_API_VERSION}/customers`, {
                    json: true,
                    body: customer,
                    headers: {
                        'x-functions-key': process.env.CUSTOMER_API_KEY
                    }
                });
                context.log(`customer inserted with id ${customer._id}`);
            }
            customerID = customer._id;
        }
        if (!order.customerID) {
            const updatedOrder = await request.patch(`${process.env.ORDER_API_URL}/api/${process.env.ORDER_API_VERSION}/orders/${mySbMsg.orderID}`, {
                json: true,
                body: {
                    customerID: customerID
                },
                headers: {
                    'x-functions-key': process.env.ORDER_API_KEY
                }
            });
            if (updatedOrder)
                context.log('CustomerID added in Order doc');
        }
        if (customerID) {
            const collection = await getMongodbCollection('Vouchers');
            const result = await collection.updateOne({
                _id: mySbMsg._id,
                partitionKey: mySbMsg.partitionKey,
                docType: 'vouchers'
            }, {
                $set: {
                    customerID: customerID
                }

            });

            if (result && result.matchedCount)
                context.log('customer linked in voucher');
        }
        return Promise.resolve();
    } catch (error) {
        context.log(error);
        return Promise.resolve();
    }
};