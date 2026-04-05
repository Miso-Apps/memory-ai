# DukiAI Memory - Backend API

FastAPI backend for DukiAI Memory application.

## Getting Started

### Prerequisites
- Python 3.11+
- PostgreSQL with pgvector extension
- Redis
- MinIO (or AWS S3)

### Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env and add your API keys
```

### Database Setup

```bash
# Start Docker services (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Run migrations
alembic upgrade head
```

### Development

```bash
# Activate virtual environment
source venv/bin/activate

# Run development server
uvicorn app.main:app --reload

# Or use Python directly
python -m app.main
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── api/              # API endpoints
│   │   ├── auth.py       # Authentication
│   │   ├── memories.py   # Memory CRUD
│   │   ├── ai.py         # AI features
│   │   └── storage.py    # File upload
│   ├── models/           # Database models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── utils/            # Utilities
│   ├── config.py         # Settings
│   ├── database.py       # DB connection
│   └── main.py           # FastAPI app
├── alembic/              # Database migrations
├── tests/                # Tests
└── requirements.txt      # Dependencies
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### Memories
- `POST /memories` - Create memory
- `GET /memories` - List memories
- `GET /memories/{id}` - Get memory
- `PUT /memories/{id}` - Update memory
- `DELETE /memories/{id}` - Delete memory
- `GET /memories/search?q=query` - Search memories

### AI Features
- `GET /ai/recall` - Get AI-powered recall
- `POST /ai/summarize/{id}` - Generate summary
- `POST /ai/reflect` - Reflect on thought

### Storage
- `POST /storage/audio` - Upload audio file
- `GET /storage/{id}` - Get file URL
- `DELETE /storage/{id}` - Delete file

## Environment Variables

See `.env.example` for all configuration options.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret key
- `OPENAI_API_KEY` - OpenAI API key

## Running Tests

```bash
pytest
```

## Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Deployment

See [DEPLOYMENT.md](../docs/DEPLOYMENT.md) for production deployment guide.
