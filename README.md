# Rupeezy Vortex Dashboard

A professional broker order placement dashboard for the **Rupeezy Vortex API**, built with Flask + React.

Designed to match [OpenAlgo](https://openalgo.in)'s DaisyUI + TailwindCSS stack and structured as a standalone Rupeezy adapter that can optionally be contributed back to OpenAlgo's `broker/` directory.

---

## Features

| Module | Description |
|---|---|
| **Auth** | OAuth login URL generation, token exchange, direct token entry |
| **Order Form** | Symbol search, LTP fetch, margin estimator, confirmation modal |
| **Order Book** | Real-time table, inline modify, cancel, 15s auto-refresh + WebSocket updates |
| **Positions** | Live P&L via WebSocket LTP, per-position and one-click square-off |
| **Holdings** | Demat holdings with live unrealised P&L |
| **Funds** | Available / used margin, NSE + MCX breakdown |
| **Watchlist** | Add symbols by token, real-time price flash animations, OHLCV |
| **Basket Orders** | Multi-leg order entry, margin netting check, bulk execution |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A Rupeezy developer account — get API credentials at [developer.rupeezy.in](https://developer.rupeezy.in)

---

## Quick Start

### 1. Clone / open the project

```bash
cd rupeezy-dashboard
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Copy the env template
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
```

Edit `.env` and fill in:

```env
RUPEEZY_API_SECRET=your_api_secret
RUPEEZY_APPLICATION_ID=your_application_id
FLASK_SECRET_KEY=some_random_string
```

Start the backend:

```bash
python app.py
# Runs on http://127.0.0.1:5000
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 4. Login

1. Open [http://localhost:5173](http://localhost:5173)
2. Enter your API Secret and Application ID
3. Click **Open Rupeezy Login Page** — a new tab opens
4. Authorise on Rupeezy; you'll be redirected back automatically
5. Alternatively paste an existing access token on the **Direct Token** tab

---

## Project Structure

```
rupeezy-dashboard/
├── backend/
│   ├── app.py          Flask app, REST API, SocketIO
│   ├── auth.py         Vortex OAuth adapter
│   ├── orders.py       Order CRUD + basket
│   ├── market.py       Quotes, positions, holdings, funds, margins
│   ├── websocket.py    VortexFeed → Flask-SocketIO bridge
│   ├── .env.example    Environment variable template
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AuthSetup.jsx
    │   │   ├── OrderForm.jsx
    │   │   ├── OrderBook.jsx
    │   │   ├── Positions.jsx
    │   │   ├── Holdings.jsx
    │   │   ├── Funds.jsx
    │   │   ├── Watchlist.jsx
    │   │   └── BasketOrder.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   └── SocketContext.jsx
    │   ├── hooks/
    │   │   └── useInterval.js
    │   ├── utils/
    │   │   ├── api.js
    │   │   └── format.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── tailwind.config.js
    ├── vite.config.js
    └── package.json
```

---

## API Reference

All endpoints are prefixed `/api/`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login-url` | Generate OAuth URL |
| POST | `/auth/exchange-token` | Exchange auth_token → access_token |
| POST | `/auth/set-token` | Directly set access token |
| GET  | `/auth/status` | Check auth + WS status |
| POST | `/auth/logout` | Clear session |

### Orders
| Method | Path | Description |
|---|---|---|
| GET    | `/orders` | Fetch order book |
| POST   | `/orders` | Place order |
| PUT    | `/orders/<id>` | Modify order |
| DELETE | `/orders/<id>` | Cancel order |
| GET    | `/orders/<id>/history` | Order audit trail |
| POST   | `/basket-orders` | Place basket (list of legs) |

### Market Data
| Method | Path | Description |
|---|---|---|
| POST | `/quotes` | Fetch LTP / OHLCV for instruments |
| GET  | `/positions` | Open positions |
| GET  | `/holdings` | Demat holdings |
| GET  | `/funds` | Margin / funds summary |
| POST | `/margins` | Multi-order margin check |
| POST | `/order-margins` | Single order margin estimate |
| GET  | `/search?q=RELIANCE&exchange=NSE_EQ` | Instrument search |

### WebSocket Subscriptions
| Method | Path | Description |
|---|---|---|
| POST | `/ws/subscribe` | Subscribe to a token's price feed |
| POST | `/ws/unsubscribe` | Unsubscribe |
| GET  | `/ws/status` | Feed connection status |

---

## WebSocket Events (frontend ← backend)

| Event | Payload | Description |
|---|---|---|
| `price_update` | `{exchange, token, ltp, ...}` | Real-time price tick |
| `order_update` | `{order_id, status, ...}` | Order state change |
| `ws_status` | `{connected: bool}` | VortexFeed connection state |
| `ws_error` | `{error: string}` | Feed error |

---

## OpenAlgo Compatibility Note

Rupeezy is **not** in OpenAlgo's official broker list. This dashboard integrates Rupeezy directly via the Vortex Python SDK (`vortex-api`). The backend adapter (`auth.py`, `orders.py`, `market.py`, `websocket.py`) follows OpenAlgo's thin-adapter pattern and can be contributed as a new broker module at `broker/rupeezy/` in the [OpenAlgo repo](https://github.com/marketcalls/openalgo).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RUPEEZY_API_SECRET` | Yes | Vortex API secret |
| `RUPEEZY_APPLICATION_ID` | Yes | Vortex application ID |
| `RUPEEZY_ACCESS_TOKEN` | Auto | Filled after OAuth |
| `RUPEEZY_REDIRECT_URL` | Yes | OAuth callback URL |
| `FLASK_SECRET_KEY` | Yes | Flask session secret |
| `PORT` | No | Backend port (default 5000) |
| `FRONTEND_URL` | No | Frontend URL for redirect (default http://localhost:5173) |

---

## Security Notes

- API credentials are **never hardcoded** — always read from `.env` or session
- `.env` is gitignored — never commit secrets
- Access tokens are stored server-side in the Flask session (not exposed to the browser)
- CORS is restricted to `localhost:5173` — update for production deployment

---

## References

- Rupeezy Vortex API docs: https://vortex.rupeezy.in/docs/
- Python SDK: https://pypi.org/project/vortex-api/
- JS SDK: https://www.npmjs.com/package/@asthatrade/jsvortex
- OpenAlgo: https://openalgo.in | https://github.com/marketcalls/openalgo
