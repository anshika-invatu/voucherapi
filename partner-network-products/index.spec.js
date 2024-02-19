'use strict';

const expect = require('chai').expect;
const helpers = require('../spec/helpers');
const request = require('request-promise');
const uuid = require('uuid');
const merchantID = uuid.v4();
const samplePartnerNetwork = { ...require('../spec/sample-docs/PartnerNetwork'), _id: uuid.v4() };
const sampleProduct = { ...require('../spec/sample-docs/Products'), _id: uuid.v4() };
const { getMongodbCollection } = require('../db/mongodb');
samplePartnerNetwork.partitionKey = samplePartnerNetwork._id;
samplePartnerNetwork.partnerNetworkMembers = [{
    merchantID: merchantID,
    merchantName: 'Turistbutiken i Åre',
    commissionAmount: 18.50,
    commissionPercent: 5.00,
    currency: 'SEK',
    roles: 'admin'
}];
const product = {
    'productName': 'The green product',
    'productDescription': 'Some description of the Product',
    'conditions': 'Some text about special conditions in text about how to use the voucher',
    'imageURL': 'https://media.vourity.com/greenburger.png',
    'isEnabledForSale': true,
    'issuer': {
        'merchantName': 'Vasamuseet'
    },
    'salesPrice': 123456789.00,
    'vatPercent': 25.00,
    'vatAmount': 2.35,
    'vatClass': 'VAT1',
    'currency': 'SEK',
    'salesPeriodStart': new Date(),
    'salesPeriodEnd': new Date()
};
let productToBeDeleted;
describe('Add,Remove and View Partner Network Products', () => {
    before(async () => {
        const productID1 = uuid.v4();
        productToBeDeleted = productID1;
        const productID2 = uuid.v4();
        const product1 = { ...product };
        const product2 = { ...product };
        product1.productID = productID1;
        product2.productID = productID2;
        samplePartnerNetwork.products = new Array(product1, product2);
        const collection = await getMongodbCollection('Vouchers');
        await collection.insertOne(samplePartnerNetwork);
    });

    
    it('should return error when id is invalid', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${123}`;
            await request.get(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });


    it('should return error when merchant id is not a memeber of partner network', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${uuid.v4()}`;
            await request.get(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 403,
                description: 'The given merchant not allowed to update the partner network.',
                reasonPhrase: 'PartnerNetworkNotAuthorized'
            };
            expect(error.statusCode).to.equal(403);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when partnerNetwork not found', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${uuid.v4()}?merchantID=${uuid.v4()}`;
            await request.get(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The partnerNetwork of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'PartnerNetworkNotFoundError'
            };
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should return products from partnerNetwork', async () => {

        const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${merchantID}`;
        const products = await request.get(url, {
            body: {},
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        
        expect(products).to.be.instanceOf(Array).and.have.lengthOf(2);
       
    });


    //Post request

    it('should return error when id is invalid', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${123}`;
            await request.post(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });


    it('should return error when merchant id is not a memeber of partner network', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${uuid.v4()}`;
            await request.post(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 403,
                description: 'The given merchant not allowed to update the partner network.',
                reasonPhrase: 'PartnerNetworkNotAuthorized'
            };
            expect(error.statusCode).to.equal(403);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when partnerNetwork not found', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${uuid.v4()}?merchantID=${uuid.v4()}`;
            await request.post(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The partnerNetwork of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'PartnerNetworkNotFoundError'
            };
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should add products in partnerNetwork', async () => {
        const productID3 = uuid.v4();
        const product3 = { ...product };
        product3.productID = productID3;
        sampleProduct._id = productID3;
        sampleProduct.partitionKey = productID3;

        await request.post(`${process.env.PRODUCT_API_URL}/api/${process.env.PRODUCT_API_VERSION}/products`, {
            json: true,
            body: sampleProduct,
            headers: {
                'x-functions-key': process.env.PRODUCT_API_KEY
            }
        });

        const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${merchantID}`;
        
        const result  = await request.post(url, {
            body: product3,
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(result).to.eql({
            code: 200,
            description: 'Successfully added the product'
        });

        const products = await request.get(url, {
            body: {},
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(products).to.be.instanceOf(Array).and.have.lengthOf(3);

        await request.delete(`${process.env.PRODUCT_API_URL}/api/${process.env.PRODUCT_API_VERSION}/products/${sampleProduct._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.PRODUCT_API_KEY
            }
        });
    });

    // Delete Request

    it('should return error when id is invalid', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${123}`;
            await request.delete(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 400,
                description: 'The partnerNetworkID field specified in the request URL does not match the UUID v4 format.',
                reasonPhrase: 'InvalidUUIDError'
            };

            expect(error.statusCode).to.equal(400);
            expect(error.error).to.eql(response);
        }
    });


    it('should return error when merchant id is not a memeber of partner network', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${uuid.v4()}`;
            await request.delete(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 403,
                description: 'The given merchant not allowed to update the partner network.',
                reasonPhrase: 'PartnerNetworkNotAuthorized'
            };
            expect(error.statusCode).to.equal(403);
            expect(error.error).to.eql(response);
        }
    });

    it('should return error when partnerNetwork not found', async () => {
        try {
            const url = helpers.API_URL + `/api/v1/partner-network-products/${uuid.v4()}?merchantID=${uuid.v4()}`;
            await request.delete(url, {
                body: {},
                json: true,
                headers: {
                    'x-functions-key': process.env.X_FUNCTIONS_KEY
                }
            });
        } catch (error) {
            const response = {
                code: 404,
                description: 'The partnerNetwork of specified details in the URL doesn\'t exist.',
                reasonPhrase: 'PartnerNetworkNotFoundError'
            };
            expect(error.statusCode).to.equal(404);
            expect(error.error).to.eql(response);
        }
    });

    it('should delete products in partnerNetwork', async () => {
        
        sampleProduct._id = productToBeDeleted;
        sampleProduct.partitionKey = productToBeDeleted;
        await request.post(`${process.env.PRODUCT_API_URL}/api/${process.env.PRODUCT_API_VERSION}/products`, {
            json: true,
            body: sampleProduct,
            headers: {
                'x-functions-key': process.env.PRODUCT_API_KEY
            }
        });

        const url = helpers.API_URL + `/api/v1/partner-network-products/${samplePartnerNetwork._id}?merchantID=${merchantID}&productID=${productToBeDeleted}`;
        const result  = await request.delete(url, {
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });

        expect(result).to.eql({
            code: 200,
            description: 'Successfully deleted the product'
        });

        const products = await request.get(url, {
            body: {},
            json: true,
            headers: {
                'x-functions-key': process.env.X_FUNCTIONS_KEY
            }
        });
        expect(products).to.be.instanceOf(Array).and.have.lengthOf(2);
        const productCheck = products.find(x=>x.productID === productToBeDeleted);
        expect(productCheck).to.be.undefined;

        await request.delete(`${process.env.PRODUCT_API_URL}/api/${process.env.PRODUCT_API_VERSION}/products/${sampleProduct._id}`, {
            json: true,
            headers: {
                'x-functions-key': process.env.PRODUCT_API_KEY
            }
        });
    });

    
    after(async () => {
        const collection = await getMongodbCollection('Vouchers');
        await collection.deleteOne({ _id: samplePartnerNetwork._id, docType: 'partnerNetworks', partitionKey: samplePartnerNetwork._id });
    });
});