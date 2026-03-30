# Estimate Takeoff

Estimate Takeoff is a self-hosted MVP for PDF area measurement on construction plans. It focuses on the core takeoff workflow only:

- create projects
- upload PDF drawing files
- view PDF pages in the browser
- calibrate each page using feet and inches
- draw polygon areas
- save calibrations and area results in PostgreSQL
- deploy on an Ubuntu VPS with Docker Compose

## What It Uses

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4
- PostgreSQL 16
- PDF.js
- react-konva / konva
- Docker Compose
- local disk PDF storage

## V1 Scope

- projects list with create, rename, and delete
- per-project PDF upload
- PDF page viewer with page navigation, zoom, and fit-to-width
- per-page calibration stored in inches-per-pixel
- polygon area tool with selection, rename, point dragging, and delete
- per-page results sidebar with individual areas and total square feet
- persistent uploads folder and PostgreSQL data

## Not Included In V1

- pricing
- quotes
- materials database
- OCR
- AI features
- multi-user collaboration
- cloud storage
- line/count/volume tools

## Environment Variables

Copy `.env.example` to `.env` and adjust values as needed:

```bash
cp .env.example .env
```

Variables:

- `DATABASE_URL`: PostgreSQL connection string used by the app and migration script
- `UPLOADS_DIR`: local directory where uploaded PDFs are stored
- `NEXT_PUBLIC_APP_URL`: public URL for the app
- `PORT`: app port
- `BASIC_AUTH_ENABLED`: set to `true` to require a shared username/password for the app
- `BASIC_AUTH_USERNAME`: shared login username for the app-wide protection
- `BASIC_AUTH_PASSWORD`: shared login password for the app-wide protection

## Internet Protection

This app does not yet have a real multi-user login system. For internet-facing deployment, it now supports simple app-wide HTTP Basic Auth.

Recommended production settings in `.env`:

```dotenv
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USERNAME=your-username
BASIC_AUTH_PASSWORD=use-a-strong-password
```

This protects:

- app pages
- upload routes
- PDF file access routes
- shape and calibration API routes

This is a deployment gate, not a user/account system.

## Local Development Setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL locally, or start only the database with Docker Compose:

```bash
docker compose up -d postgres
```

3. Create the local environment file and uploads directory:

```bash
cp .env.example .env
mkdir -p uploads
```

4. Run database migrations:

```bash
npm run migrate
```

5. Start the development server:

```bash
npm run dev
```

6. Open `http://localhost:3000`

## Production Deployment On Ubuntu VPS

These commands assume Docker Engine and the Docker Compose plugin are already installed.

1. Clone the repo:

```bash
git clone https://github.com/vmsosa86/estimate-takeoff.git
cd estimate-takeoff
```

2. Create the environment file and uploads directory:

```bash
cp .env.example .env
mkdir -p uploads
```

3. If the app will run on a real domain, update `.env`:

```dotenv
NEXT_PUBLIC_APP_URL=https://your-domain.com
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USERNAME=your-username
BASIC_AUTH_PASSWORD=use-a-strong-password
```

4. Build and start the stack:

```bash
docker compose up -d --build
```

5. Confirm the containers are healthy:

```bash
docker compose ps
docker compose logs -f app
```

The app will be available at `http://YOUR_SERVER_IP:3000`.

## Nginx Reverse Proxy

A sample Nginx site config is included at [`deployment/nginx/estimate-takeoff.conf`](/Users/victormsosa/Repos/Estimate%20TakeOff/deployment/nginx/estimate-takeoff.conf).

Key points in that config:

- proxies traffic to `127.0.0.1:3000`
- sets `client_max_body_size 100M` for large PDF uploads
- forwards the usual reverse-proxy headers
- keeps upgrade headers for modern app traffic

Typical Ubuntu install steps:

```bash
sudo cp deployment/nginx/estimate-takeoff.conf /etc/nginx/sites-available/estimate-takeoff
sudo ln -s /etc/nginx/sites-available/estimate-takeoff /etc/nginx/sites-enabled/estimate-takeoff
sudo nginx -t
sudo systemctl reload nginx
```

Update `server_name estimate.example.com;` to your real domain before enabling it.

## Let's Encrypt SSL

After Nginx is serving your domain on port 80 and DNS already points to the VPS:

1. Install Certbot:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

2. Issue the certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

3. Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

After SSL is in place, set:

```dotenv
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Docker Compose Usage

Start:

```bash
docker compose up -d
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

Remove containers and PostgreSQL volume:

```bash
docker compose down -v
```

## Database Migration Steps

Local:

```bash
npm run migrate
```

Inside Docker:

```bash
docker compose run --rm app npm run migrate
```

The app container also runs migrations automatically on startup before `next start`.

## Uploaded PDF Storage

Uploaded PDFs are stored on local disk.

- local development default: `./uploads`
- Docker Compose mount: `./uploads:/app/uploads`
- PostgreSQL data persists in the Docker volume `estimate-takeoff-postgres-data`

Inside PostgreSQL, file metadata is saved in `project_files`, and individual page metadata is saved in `pdf_pages`.

## Backup

### Backup PostgreSQL

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U estimate_takeoff -d estimate_takeoff > backups/estimate_takeoff.sql
```

### Backup Uploads Directory

```bash
tar -czf backups/estimate_takeoff_uploads.tar.gz uploads
```

### Combined Quick Backup

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U estimate_takeoff -d estimate_takeoff > backups/estimate_takeoff.sql
tar -czf backups/estimate_takeoff_uploads.tar.gz uploads
```

## Restore

### Restore PostgreSQL

If needed, recreate the database container first:

```bash
docker compose down
docker compose up -d postgres
```

Restore the SQL dump:

```bash
cat backups/estimate_takeoff.sql | docker compose exec -T postgres psql -U estimate_takeoff -d estimate_takeoff
```

### Restore Uploads Directory

```bash
tar -xzf backups/estimate_takeoff_uploads.tar.gz
```

## Common Troubleshooting

- `DATABASE_URL is required`
  Make sure `.env` exists and is loaded before running `npm run migrate`, `npm run dev`, or Docker Compose.

- PDFs upload but do not render
  Confirm the file is a valid PDF and that the browser can load `/api/files/<id>/content`.

- Shapes show `Unavailable`
  The page has not been calibrated yet, or calibration needs to be saved again.

- Docker app cannot connect to PostgreSQL
  Run `docker compose logs -f postgres` and confirm the `postgres` container is healthy before the app starts.

- Uploaded files disappear after redeploy
  Make sure the host `uploads` directory exists and the Docker mount is active.

- Browser prompts for login unexpectedly
  Basic Auth is enabled. Use the credentials from your `.env` file, or set `BASIC_AUTH_ENABLED=false` and rebuild.

## Verify Listen And Persistence

Verify the app is listening on the VPS:

```bash
docker compose ps
curl -I http://127.0.0.1:3000/projects
```

Expected result:

- `app` container should publish `0.0.0.0:3000->3000`
- `/projects` should respond with `200` or `401` if Basic Auth is enabled

Verify PostgreSQL persistence:

```bash
docker volume inspect estimate-takeoff-postgres-data
```

Verify uploads persistence:

```bash
ls -la uploads
docker compose exec app ls -la /app/uploads
```

## First Launch Checklist

- DNS points your domain to the VPS public IP
- `.env` exists on the VPS and includes the correct `NEXT_PUBLIC_APP_URL`
- `BASIC_AUTH_ENABLED=true`
- `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` are set
- `uploads/` exists on the host
- `docker compose up -d --build` completes successfully
- `docker compose ps` shows both `app` and `postgres` healthy/running
- `curl -I http://127.0.0.1:3000/projects` returns `200` or `401`
- Nginx config is installed and `sudo nginx -t` passes
- Certbot certificate is issued and HTTPS loads
- One test PDF uploads successfully
- One calibration and one saved area persist after refresh

## Exact Ubuntu VPS Commands

```bash
git clone https://github.com/vmsosa86/estimate-takeoff.git
cd estimate-takeoff
cp .env.example .env
mkdir -p uploads
docker compose up -d --build
docker compose ps
docker compose logs -f app
```
