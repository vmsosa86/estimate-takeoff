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
