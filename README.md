# 🚨 City Evacuation 
### 8-Puzzle · A\* Algorithm · React 18 + Flask 3 · 


## 📁 Project Structure

```
evacuation-v2/
├── backend/
│   ├── app.py              ← Flask API + A* solver (fully documented)
│   ├── requirements.txt    ← flask, flask-cors, gunicorn
│   └── Dockerfile          ← Production container (non-root, gunicorn)
├── frontend/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js          ← React 18 (Tile animation, Tech Stats modal)
│   │   ├── App.css         ← Full dark tactical theme
│   │   └── index.js
│   └── package.json
├── vercel.json             ← Frontend deploy config
└── README.md
```

---

## ⚙️ Run Locally

### Prerequisites
- Python **3.11+** → `python --version`
- Node.js **18+**  → `node --version`

---

### 🐍 Backend (Terminal 1)

```bash
cd evacuation-v2/backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start dev server
python app.py
# → http://localhost:5000
```

---

### ⚛️ Frontend (Terminal 2)

```bash
cd evacuation-v2/frontend

npm install
npm start
# → http://localhost:3000 (auto-opens)
```

---

---

## 🚀 Deploy to Production

### Backend → Render.com (free tier)

1. Push project to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo, set **Root Directory** to `backend/`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `gunicorn --bind 0.0.0.0:$PORT app:app`
6. Copy the deployment URL (e.g. `https://evacuation-ai.onrender.com`)

### Frontend → Vercel (free tier)

1. Edit `frontend/src/App.js` line 14:
   ```js
   const API = "https://evacuation-ai.onrender.com";   // your Render URL
   ```
2. Push to GitHub
3. Go to [vercel.com](https://vercel.com) → **Add New Project**
4. Import repo, set **Root Directory** to `frontend/`
5. Deploy — Vercel auto-detects Create React App

---

## 🔌 API Reference

| Endpoint | Method | Body | Description |
|---|---|---|---|
| `/health` | GET | — | Liveness probe |
| `/shuffle` | GET | — | Solvable shuffled board. Optional `?moves=N` for difficulty |
| `/solve` | POST | `{"board":[...]}` | A\* solution + full observability metrics |
| `/move` | POST | `{"board":[...],"tile_index":N}` | Validate + apply one human move |
| `/stats` | GET | — | Session step count + elapsed time |
| `/reset` | POST | — | Clear session |

### `/solve` Response (v2)

```json
{
  "solution_path": [{"board":[...],"move":"right","step":1}, ...],
  "solution_depth":   20,
  "nodes_explored":   1847,
  "time_taken_ms":    12.4,
  "branching_factor": 1.523,
  "heuristic_start":  18,
  "algorithm":        "A* · Manhattan Distance · heapq + closed-set O(1)"
}
```

---



### A\* with Manhattan Distance

```
f(n) = g(n) + h(n)
g(n) = moves taken so far (exact cost)
h(n) = Σ |row_curr - row_goal| + |col_curr - col_goal|  for each tile
```

**Why it's optimal:** Manhattan distance is **admissible** (never overestimates), so A\* with it is guaranteed to find the shortest solution.

**Why it's fast:**
- `heapq` keeps the open list as a min-heap → O(log n) insert/pop
- Python `set` of tuples for the closed list → O(1) membership test
- `GOAL_INDEX_MAP` dict → O(1) goal-position lookup per tile per heuristic call

**Effective branching factor** (`nodes^(1/depth)`) is typically 1.3–1.8 for hard 8-puzzle instances, much better than BFS's ~3.0.



---



*City Evacuation AI v2 · React 18 · Flask 3 · A\* · Docker · Vercel*
