'use strict';

const {handler} = require('./index');

const event = {
  Records: [
    {
      EventSource: 'aws:sns',
      EventSubscriptionArn:
        'arn:aws:sns:us-east-1:000000000000:orders:local-subscription',
      Sns: {
        Message: JSON.stringify({
          orderId: 'order-local-001',
          product: 'Notebook',
          quantity: 1,
        }),
        MessageId: 'local-message-001',
        TopicArn: 'arn:aws:sns:us-east-1:000000000000:orders',
        Timestamp: new Date().toISOString(),
      },
    },
  ],
};

handler(event)
  .then((result) => {
    console.log('Local invocation result:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
