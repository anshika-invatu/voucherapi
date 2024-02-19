'use strict';

const request = require('request-promise');

exports.getMerchantById = id => {
    const url = `${process.env.MERCHANTS_API_URL}/api/${process.env.MERCHANTS_API_VERSION}/merchants/${id}`;
    return request.get(url, {
        headers: {
            'x-functions-key': process.env.MERCHANTS_API_KEY
        },
        json: true
    });
};