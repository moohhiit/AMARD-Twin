# AMARD — Railway Control System

Yeh project **do alag parts** mein split hai:

```
AMARD/
├── backend/    ← Express + Socket.IO + MongoDB + Neo4j
└── frontend/   ← React + Vite + Tailwind
```

---

## Backend Start karo (Terminal 1)

```bash
cd backend
npm install
npm run seed        # pehli baar — MongoDB + Neo4j data seed karo
npm run dev         # development (nodemon auto-restart)
# ya
npm start           # production
```

Backend port **3000** pe chalta hai.  
Engine **nahi chalta** jab tak frontend `POST /api/v1/simulation/start` na bheje.

---

## Frontend Start karo (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Frontend port **5173** pe chalta hai.  
Khulte hi ek **"Waking up server…"** popup dikhega — yeh server ko poll karta hai.  
Jab backend ready hoga, frontend automatically engine start karega aur popup hat jayega.

---

## Flow

```
Backend start  →  DBs connect  →  Engine idle (wait karta hai)
Frontend start →  Wakeup popup dikhta hai
               →  /health poll (har 2 sec)
               →  Server ready  →  POST /simulation/start
               →  Engine start  →  Popup hat jata hai
               →  Normal dashboard
```

---

## Environment Variables (backend/.env)

```
PORT=3000
MONGODB_URI=...
MONGODB_DB_NAME=railway_control
NEO4J_URI=...
NEO4J_USER=...
NEO4J_PASSWORD=...
SIMULATION_SPEED=1
ENGINE_TICK_MS=100
LOG_LEVEL=info
CORS_ORIGIN=*
```
