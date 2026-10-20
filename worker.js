
const { createClient } = require('redis');

const redis = createClient({
  url: 'redis://localhost:6379'
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

const STREAM = 'lab:jobs';
const GROUP = 'lab-workers';
const CONSUMER = `worker-${process.pid}`;

async function startWorker() {
  await redis.connect();

  try {
    await redis.xGroupCreate(STREAM, GROUP, '0', {
      MKSTREAM: true
    });
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) {
      throw err;
    }
  }

  console.log(`${CONSUMER} is waiting for jobs...`);

  while (true) {
    const batches = await redis.xReadGroup(
      GROUP,
      CONSUMER,
      [{ key: STREAM, id: '>' }],
      { COUNT: 10, BLOCK: 5000 }
    );

    if (!batches) continue;

    for (const batch of batches) {
      for (const job of batch.messages) {
        try {
          console.log('Processing:', job.message.message);

          // Replace this with your actual background task.
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await redis.xAck(STREAM, GROUP, job.id);
          console.log('Completed:', job.id);
        } catch (err) {
          console.error('Job failed:', job.id, err);
          // Leave unacknowledged for later recovery.
        }
      }
    }
  }
}

startWorker().catch(console.error);
