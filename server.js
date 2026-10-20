const express = require('express');
const { createClient } = require('redis');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const redis = createClient({
  url: 'redis://localhost:6379'
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

async function startServer() {
  await redis.connect();

  app.get('/', (req, res) => {
    res.send('Hello World!');
  });

  app.get('/data', async (req, res) => {
    try {
      const cached = await redis.get('lab:data');

      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      // Simulate some work when the cache is empty.
      const numbers = Array.from(
        { length: 10000 },
        (_, i) => i + 1
      );

      const result = {
        count: numbers.length,
        sum: numbers.reduce((a, b) => a + b, 0)
      };

      await redis.set('lab:data', JSON.stringify(result), {
        EX: 30
      });

      res.set('X-Cache', 'MISS');
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/jobs', async (req, res) => {
    try {
      const { message } = req.body;

      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
          error: 'A non-empty message is required'
        });
      }

      const jobId = await redis.xAdd(
        'lab:jobs',
        '*',
        { message: message.trim() }
      );

      res.status(202).json({
        status: 'queued',
        jobId
      });
    } catch (err) {
      res.status(500).json({ error: 'Could not queue job' });
    }
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
