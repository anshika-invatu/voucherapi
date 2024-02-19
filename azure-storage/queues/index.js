// 'use strict';

// const azure = require('azure-storage');
// const Promise = require('bluebird');
// const retryOperations = new azure.LinearRetryPolicyFilter(3, 3000);

// let queueService;
// if (process.env.NODE_ENV === 'development') {
//     const devStoreCreds = azure.generateDevelopmentStorageCredentials();
//     queueService = azure.createQueueService(devStoreCreds);
// } else {
//     queueService = azure
//         .createQueueService(process.env.AZURE_STORAGE_CONNECTION_STRING)
//         .withFilter(retryOperations);
// }
// queueService.messageEncoder = new azure.QueueMessageEncoder.TextBase64QueueMessageEncoder();

// if (process.env.DEBUG_STORAGE_QUEUES === 'true') {
//     queueService.logger.level = azure.Logger.LogLevels.DEBUG;
// }

// const queueServiceAsync = Promise.promisifyAll(queueService);

// module.exports = queueServiceAsync;