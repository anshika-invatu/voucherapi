'use strict';

'use strict';

const queueService = require('./index');
const queues = [
    
];

exports.initQueues = () => {
    const promises = [];

    for (const queue of queues) {
        /**
         * Create two queues for each.
         * The second queue is used with tests to ensure the message is not picked up by AF.
         */
        promises.push(queueService.createQueueIfNotExistsAsync(queue));
        promises.push(queueService.createQueueIfNotExistsAsync(queue + '-test'));
    }

    return Promise.all(promises);
};
