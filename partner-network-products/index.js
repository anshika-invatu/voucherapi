'use strict';

const { getMongodbCollection } = require('../db/mongodb');
const utils = require('../utils');
const errors = require('../errors');
const request = require('request-promise');

//Please refer the bac-350 for further details

module.exports = async function (context, req) {
    try {
        switch (context.req.method.toLowerCase()) {
            case 'get':
                await view_products(context, req);
                break;
            case 'post':
                await add_products(context, req);
                break;
            case 'delete':
                await remove_products(context, req);
                break;
        }
    } catch (error) {
        utils.handleError(context, error);
    }
};

async function view_products (context, req) {

    await utils.validateUUIDField(context, req.params.partnerNetworkID, 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.');
    const voucherCollection = await getMongodbCollection('Vouchers');
    const partnerNetwork = await voucherCollection.findOne({
        _id: req.params.partnerNetworkID,
        docType: 'partnerNetworks',
        partitionKey: req.params.partnerNetworkID
    });
    let isMerchantIsValid = false;
    if (partnerNetwork) {

        if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
            partnerNetwork.partnerNetworkMembers.forEach(element => {
                if (element.merchantID === req.query.merchantID) {
                    isMerchantIsValid = true;
                }
            });
        }


    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotFoundError(
                'The partnerNetwork of specified details in the URL doesn\'t exist.',
                404
            )
        );
        return;
    }

    if (isMerchantIsValid) {
        context.res = {
            body: partnerNetwork.products ? partnerNetwork.products : new Array()
        };
    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotAuthorized(
                'The given merchant not allowed to update the partner network.',
                403
            )
        );
    }

}

async function add_products (context, req) {
    await utils.validateUUIDField(context, req.params.partnerNetworkID, 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.');
    const voucherCollection = await getMongodbCollection('Vouchers');
    const partnerNetwork = await voucherCollection.findOne({
        _id: req.params.partnerNetworkID,
        docType: 'partnerNetworks',
        partitionKey: req.params.partnerNetworkID
    });
    let isMerchantIsValid = false;
    if (partnerNetwork) {

        if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
            partnerNetwork.partnerNetworkMembers.forEach(element => {
                if (element.merchantID === req.query.merchantID && element.roles === 'admin') {
                    isMerchantIsValid = true;
                }
            });
        }


    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotFoundError(
                'The partnerNetwork of specified details in the URL doesn\'t exist.',
                404
            )
        );
        return;
    }

    if (isMerchantIsValid) {
        const result = await voucherCollection.updateOne({
            _id: req.params.partnerNetworkID,
            docType: 'partnerNetworks',
            partitionKey: req.params.partnerNetworkID
        },
        {
            $push: { products: req.body }
        });
        let updatedProduct;
        if (result && result.matchedCount) {
            updatedProduct = await request.post(process.env.PRODUCT_API_URL + `/api/${process.env.PRODUCT_API_VERSION}/update-products-partner-network-section/${req.body.productID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.PRODUCT_API_KEY
                },
                body: {
                    partnerNetworkID: partnerNetwork._id,
                    partnerNetworkName: partnerNetwork.partnerNetworkName
                }
            });
        }
        if (updatedProduct) {
            context.res = {
                body: {
                    code: 200,
                    description: 'Successfully added the product'
                }
            };
        }
    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotAuthorized(
                'The given merchant not allowed to update the partner network.',
                403
            )
        );
    }
}

async function remove_products (context, req) {
    await utils.validateUUIDField(context, req.params.partnerNetworkID, 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.');
    const voucherCollection = await getMongodbCollection('Vouchers');
    const partnerNetwork = await voucherCollection.findOne({
        _id: req.params.partnerNetworkID,
        docType: 'partnerNetworks',
        partitionKey: req.params.partnerNetworkID
    });
    let isMerchantIsValid = false;
    if (partnerNetwork) {

        if (partnerNetwork && partnerNetwork.partnerNetworkMembers && Array.isArray(partnerNetwork.partnerNetworkMembers)) {
            partnerNetwork.partnerNetworkMembers.forEach(element => {
                if (element.merchantID === req.query.merchantID && element.roles === 'admin') {
                    isMerchantIsValid = true;
                }
            });
        }


    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotFoundError(
                'The partnerNetwork of specified details in the URL doesn\'t exist.',
                404
            )
        );
        return;
    }

    if (isMerchantIsValid) {
        const result = await voucherCollection.updateOne({
            _id: req.params.partnerNetworkID,
            docType: 'partnerNetworks',
            partitionKey: req.params.partnerNetworkID
        },
        {
            $pull: { products: { productID: req.query.productID }},
        });

        let updatedProduct;
        if (result && result.matchedCount) {
            updatedProduct = await request.delete(process.env.PRODUCT_API_URL + `/api/${process.env.PRODUCT_API_VERSION}/update-products-partner-network-section/${req.query.productID}`, {
                json: true,
                headers: {
                    'x-functions-key': process.env.PRODUCT_API_KEY
                },
                body: {
                    partnerNetworkID: partnerNetwork._id,
                    partnerNetworkName: partnerNetwork.partnerNetworkName
                }
            });
           
        }
        if (updatedProduct) {
            context.res = {
                body: {
                    code: 200,
                    description: 'Successfully deleted the product'
                }
            };
        }

    } else {
        utils.setContextResError(
            context,
            new errors.PartnerNetworkNotAuthorized(
                'The given merchant not allowed to update the partner network.',
                403
            )
        );
    }
}