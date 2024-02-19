'use strict';

const genericErrorCodes = [
    'EmptyRequestBodyError',
    'InvalidUUIDError'
];

exports.merchantApiErrorCodes = genericErrorCodes.concat([
    'MerchantsApiServerError',
    'DuplicateMerchantError',
    'MerchantNotFoundError',
    'BusinessUnitNotFoundError',
    'MissingWebShopTokenError',
    'DuplicateWebShopError',
    'WebShopNotFoundError'
]);
