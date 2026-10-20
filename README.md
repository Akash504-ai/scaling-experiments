# Scaling Experiments

A hands-on backend experiment exploring caching, asynchronous job processing, reverse proxies, load balancing, and HTTP load testing using Node.js, Express, Redis, Redis Streams, and Nginx.

The goal of this project is to understand how these components work together and investigate how adding a load balancer and multiple application instances affects performance in a local environment.

## Overview

The project starts with an Express API and gradually introduces infrastructure commonly used in backend systems.

- **Node.js and Express** — Build and serve the HTTP API.
- **Redis** — Cache API responses with a time-to-live (TTL).
- **Redis Streams** — Queue background jobs for asynchronous processing.
- **Worker process** — Consume queued jobs using a Redis consumer group and acknowledge processed messages.
- **Nginx** — Act as a reverse proxy and distribute incoming requests across two Express instances.
- **Autocannon** — Generate concurrent HTTP requests to benchmark the API.

This is a local learning project, not a production-ready deployment.

## Architecture

The system consists of two Express instances, a shared Redis instance, a background worker, and an Nginx reverse proxy.

```text
                         Autocannon
                              |
                              v
                        Nginx :8080
                       /            \
                      v              v
               Express :3000   Express :3001
                      |              |
                      +-------+------+
                              |
                              v
                         Redis :6379
                         /         \
                        v           v
                   API Cache    Redis Streams
                   TTL: 30s      Job Queue
                                     |
                                     v
                                  Worker
                                worker.js
```

### Request flow

**Load balancing**

Autocannon sends HTTP requests to Nginx on port `8080`. Nginx forwards requests to the two Express instances configured in `nginx.conf`.

**Caching**

The `/data` endpoint uses Redis to cache responses with a 30-second TTL. Subsequent requests can reuse a cached response while the entry remains valid.

**Background processing**

Clients submit jobs through `POST /jobs`. Jobs are added to a Redis Stream, allowing the API to enqueue work without processing it directly in the request handler. The separate worker consumes messages through a Redis consumer group and acknowledges processed messages using `XACK`.

## Technology Stack

| Technology | Purpose |
|---|---|
| JavaScript | Application logic |
| Node.js | JavaScript runtime |
| Express | HTTP API |
| Redis | Shared cache and stream storage |
| Redis Streams | Background job queue |
| Nginx | Reverse proxy and load balancing |
| Docker | Running Redis and Nginx locally |
| Autocannon | HTTP load testing |

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Docker Desktop
- Git

The setup below assumes Windows with Command Prompt. Adapt the environment variable commands if you use another shell.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Akash504-ai/scaling-experiments.git
cd scaling-experiments
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start Redis

Run Redis in Docker:

```bash
docker run -d --name redis-lab -p 6379:6379 redis:7-alpine
```

Check that the container is running:

```bash
docker ps
```

If the container already exists, start it with:

```bash
docker start redis-lab
```

### 4. Start the first Express instance

Open a terminal in the project directory:

```bat
set PORT=3000 && npm run dev
```

### 5. Start the second Express instance

Open another terminal in the same directory:

```bat
set PORT=3001 && npm run dev
```

Both instances run the same application code on different ports.

### 6. Start the background worker

Open another terminal and run:

```bash
node worker.js
```

Keep the worker running while testing the job queue.

### 7. Start Nginx

The supplied `nginx.conf` configures an upstream containing both Express instances. It uses `host.docker.internal` to reach the host machine from the Nginx container.

From the project directory, run:

```bash
docker run -d --name nginx-lab -p 8080:80 --add-host=host.docker.internal:host-gateway -v "%cd%/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine
```

Check the Nginx configuration:

```bash
docker exec nginx-lab nginx -t
```

Nginx should now be accessible at:

```text
http://localhost:8080
```

The direct Express instances are available at:

```text
http://localhost:3000
http://localhost:3001
```

## API Endpoints

The application includes the following endpoints.

| Endpoint | Purpose |
|---|---|
| `GET /` | Basic API endpoint used for request testing |
| `GET /data` | Demonstrates Redis response caching with a 30-second TTL |
| `POST /jobs` | Enqueues a background job in Redis Streams |

### `GET /`

Use the root endpoint for basic connectivity checks and HTTP benchmarking.

```bash
curl http://localhost:3000/
```

### `GET /data`

This endpoint demonstrates caching with Redis.

```bash
curl http://localhost:3000/data
```

The cache entry uses a 30-second TTL. The first request may need to populate the cache, while later requests can use the cached value until it expires.

### `POST /jobs`

This endpoint submits a job to the Redis Stream for asynchronous processing.

Example request:

```bash
curl -X POST http://localhost:3000/jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"task\":\"example-job\"}"
```

The worker consumes jobs from the stream and acknowledges successfully processed messages using `XACK`.

The exact request payload and response format should match the implementation in `server.js`.

## Load Testing

Autocannon was used to generate concurrent HTTP traffic and measure request throughput and latency.

For example, test the direct Express instance:

```bash
npx autocannon -c 50 -d 20 http://localhost:3001/
```

Test the same endpoint through Nginx:

```bash
npx autocannon -c 50 -d 20 http://localhost:8080/
```

Where:

- `-c 50` specifies 50 concurrent connections.
- `-d 20` runs the test for 20 seconds.

Use the same endpoint and test parameters when comparing runs. Results can vary with system load, connection handling, caching, and the local Docker and networking environment.

## Observed Local Benchmark Results

The following results were observed during one set of local tests.

| Configuration | Throughput |
|---|---:|
| Direct Express instance (`:3001`) | Approximately 20,058 requests/second |
| Nginx with two Express instances | Approximately 5,165 requests/second |

The Nginx run also reported 79 errors.

These measurements are observations from a local development environment, not production benchmarks. They do not establish that one configuration is universally faster than the other.

The lower throughput and reported errors in the Nginx test indicate that the setup and test conditions require further investigation. Possible areas to examine include proxy overhead, connection handling, error details, and host resource usage.

The results are useful as a starting point for understanding why adding application instances does not automatically improve measured performance.

## What This Project Explores

- How a reverse proxy forwards requests to multiple application instances.
- How a shared Redis cache can be used across instances.
- How Redis Streams can decouple job submission from background processing.
- How consumer groups and message acknowledgements work.
- How to benchmark HTTP endpoints with concurrent requests.
- Why local benchmark results need to be interpreted carefully.

## Limitations

- Designed for local experimentation rather than production deployment.
- No production-grade authentication, authorization, or rate limiting.
- No production-ready monitoring or observability setup.
- Background job failure recovery and retry behavior require further work before production use.
- Load-test results depend on the machine, Docker configuration, networking, and test conditions.
- The Nginx benchmark has reported errors that have not been fully investigated.

## Future Experiments

Potential follow-up experiments include:

- Investigating the Nginx benchmark errors and throughput difference.
- Comparing cached and uncached endpoint performance.
- Testing different concurrency levels and test durations.
- Measuring latency percentiles alongside throughput.
- Exploring worker failure handling and message recovery.

These are possible directions for further learning, not claims about features already implemented.

## Repository Structure

```text
scaling-experiments/
├── nginx.conf
├── package.json
├── package-lock.json
├── server.js
├── worker.js
└── .gitignore
```

- `server.js` — Express application, API endpoints, and Redis integration.
- `worker.js` — Background job consumer.
- `nginx.conf` — Nginx reverse proxy and upstream configuration.
- `package.json` — Project scripts and dependencies.
- `.gitignore` — Files and directories excluded from version control.

## License

No license has been specified yet. Until a license is added to the repository, others should not assume they have permission to reuse, modify, or redistribute the code.
