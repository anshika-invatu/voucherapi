const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const request = require('request-promise');


module.exports = (context, mySbMsg) => {
    if (!mySbMsg || mySbMsg.docType !== 'wallets') {
        return Promise.resolve();
    }
    let voucherCollection;
    return getMongodbCollection('Vouchers')
        .then(collection => {
            voucherCollection = collection;
            return request.get(process.env.PASSES_API_URL + '/api/' + process.env.PASSES_API__VERSION + '/wallets/' + mySbMsg._id + '/passes', {
                json: true,
                headers: {
                    'x-functions-key': process.env.PASSES_API_KEY
                }
            });
        })
        .then(passes => {
            if (passes && passes.length) {
                const voucherUpdateRequest = new Array();
                const passesTokens = passes.map(x => utils.hashToken(x.passToken));
                if (passesTokens.length) {
                    passesTokens.forEach(element => {
                        voucherUpdateRequest.push(voucherCollection.update(
                            {
                                passToken: element,
                                partitionKey: element
                            },
                            {
                                $set: {
                                    isRedeemed: true,
                                    isExpired: true,
                                    'validPeriod.validToDate': new Date(),
                                    ttl: 60 * 60 * 24 * 30, // ttl for 30 days
                                    event: 'expired',
                                    updatedDate: new Date()
                                }

                            }));
                    });
                    return Promise.all(voucherUpdateRequest);

                }
            }
        })
        .then(result => {
            if (result) {
                console.log(result[0]);
            }
        })
        .catch(error => {
            if (error.error) {
                console.log(error.error);
            } else {
                console.log(error);
            }
        });

};