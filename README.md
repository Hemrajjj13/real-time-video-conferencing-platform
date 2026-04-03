# SyncSpace

SyncSpace is a full-stack video meeting app built with React, Vite, Express, MongoDB, and Socket.IO.

It supports:

- user signup and login
- creating and joining meeting rooms
- live chat inside meetings
- participant presence updates
- recent room history
- camera, microphone, and screen share controls
- responsive meeting and dashboard UI

## Project Structure

```text
Zoom-main/
  backend/
  frontend/
```

- `backend` contains the Express API, MongoDB models, and Socket.IO server
- `frontend` contains the React + Vite client

## Features

- Authentication with username and password
- Token-based session handling
- Meeting room join flow with display name
- Live chat between participants
- Recent room history on the home page
- Meeting history page
- Camera-off avatar fallback tiles
- Screen sharing support

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Axios
- Socket.IO Client

### Backend

- Express
- MongoDB with Mongoose
- Socket.IO
- bcrypt

## Requirements

- Node.js 18+
- npm
- MongoDB connection string

## Environment Variables

### Backend

Create a `.env` file inside `backend/`:

```env
MONGO_URI=your_mongodb_connection_string
PORT=8000
```

### Frontend

Optional `.env` file inside `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

If `VITE_API_BASE_URL` is not set, the frontend uses `http://localhost:8000`.

## Installation

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Running Locally

Open two terminals.

### Terminal 1: backend

```bash
cd backend
npm run dev
```

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Frontend runs on Vite's local dev server.
Backend runs on `http://localhost:8000`.

## Available Scripts

### Backend

```bash
npm run dev
npm start
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## API Routes

Base route:

```text
/api/v1/users
```

Endpoints:

- `POST /register`
- `POST /login`
- `POST /add_to_activity`
- `GET /get_all_activity`

## Socket Events

Used for live meeting communication:

- `join-call`
- `signal`
- `chat-message`
- `media-state`
- `user-joined`
- `user-left`

## Notes For Local Testing

- If you test two users on the same machine, one physical webcam may be locked by one browser at a time.
- In that case, the second participant can still join, chat, and appear with an avatar fallback tile.
- If socket behavior changes after backend edits, restart the backend server.

## Build

Frontend production build:

```bash
cd frontend
npm run build
```

## Current Status

This project is set up as a mid-level Zoom-style meeting app with the following working flows:

- auth
- meeting join/create
- live chat
- room history
- responsive UI

## Future Improvements

- persistent meeting participants in database
- better call quality and reconnection handling
- invite sharing improvements
- production deployment config
